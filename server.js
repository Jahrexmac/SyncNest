const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const cors = require('cors');
const mime = require('mime-types');
const mammoth = require('mammoth');
const multer = require('multer');
const checkDiskSpace = require('check-disk-space').default;
const sqlite3 = require('sqlite3').verbose();
const ffmpeg = require("fluent-ffmpeg");
const { dir } = require('console');

// Initialize the express app
const app = express();
const port = 8080;

// Enable CORS for handling requests from different origins
app.use(cors());
// app.use(express.static(path.join(__dirname, 'build')));

// Define the database path
// Home directory for the user
const homeDirectory = os.homedir();
const dbFolder = path.join(homeDirectory, 'SyncNestDb');
if (!fs.existsSync(dbFolder)) {
    fs.mkdirSync(dbFolder, { recursive: true });
  }

// Define the database path
const dbPath = path.join(dbFolder, 'data.db');


// Initialize the database
let db;

// Function to initialize the database (create if not exists)
function initializeDatabase() {
  // Check if the database file exists, if not, create a new database
  db = new sqlite3.Database(dbPath, (err) => {
   
  });

  // Create tables if they don't already exist
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT,
        name TEXT,
        action TEXT,
        time TEXT
      )
    `, (err) => {
      
    });
  });
}

initializeDatabase();

// Supported media file types
const supportedVideoExtensions = ['.mp4', '.mkv', '.avi'];
const supportedMusicExtensions = ['.mp3', '.wav', '.flac'];
const supportedDocumentExtensions = ['.pdf', '.docx', '.txt', '.pptx'];
const supportedImageExtensions = ['.jpg', '.jpeg', '.png', '.gif'];

// Home directory for the user
const videoDirectory = path.join(homeDirectory, 'Videos');
const musicDirectory = path.join(homeDirectory, 'Music');
const documentDirectory = path.join(homeDirectory, 'Documents');
const imageDirectory = path.join(homeDirectory, 'Pictures');
const thumbnailDirectory = path.join(homeDirectory, 'SyncNestData');

if (!fs.existsSync(thumbnailDirectory)) {
    fs.mkdirSync(thumbnailDirectory);
}

function getLocalIpAddress() {
    const networkInterfaces = os.networkInterfaces();
    for (const interfaceName in networkInterfaces) {
        const interfaces = networkInterfaces[interfaceName];
        for (const iface of interfaces) {
            // Look for the IPv4 address and ensure it's not internal (like 127.0.0.1)
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'IP address not found';
}

getLocalIpAddress()

// Function to check file extensions
function isSupportedFile(file, supportedExtensions) {
    return supportedExtensions.includes(path.extname(file).toLowerCase());
}

// Function to read files from a directory
async function readFilesFromDirectory(directoryPath, supportedExtensions) {
    const filesData = [];

    try {
        const files = fs.readdirSync(directoryPath);
        for (let file of files) {
            const filePath = path.join(directoryPath, file);
            const stat = fs.statSync(filePath);

            if (stat.isDirectory()) continue;

            if (isSupportedFile(file, supportedExtensions)) {
                const title = path.basename(file, path.extname(file));
                filesData.push({
                    title,
                    file: filePath.replace(homeDirectory, ''),
                });
            }
        }
    } catch (error) {
        console.warn(`Error reading directory: ${error.message}`);
    }

    return filesData;
}

// Function to generate a thumbnail for videos
function generateThumbnail(videoPath, outputThumbnailPath, callback) {
    const command = `ffmpeg -i "${videoPath}" -ss 00:00:10.000 -vframes 1 "${outputThumbnailPath}"`;

    exec(command, (error) => {
        if (error) {
            callback(null);
        } else {
            callback(outputThumbnailPath);
        }
    });
}

// Function to check if thumbnail already exists
function isThumbnailExist(thumbnailPath) {
    return fs.existsSync(thumbnailPath);
}

// Function to read videos with thumbnail generation
async function readVideoFiles(directoryPath) {
    const videoFiles = [];

    try {
        const files = fs.readdirSync(directoryPath);
        for (let file of files) {
            const filePath = path.join(directoryPath, file);
            const stat = fs.statSync(filePath);

            if (stat.isDirectory()) continue;

            if (isSupportedFile(file, supportedVideoExtensions)) {
                const title = path.basename(file, path.extname(file));
                const thumbnailPath = path.join(thumbnailDirectory, `${title}.jpg`);

                if (!isThumbnailExist(thumbnailPath)) {
                    generateThumbnail(filePath, thumbnailPath, (generatedThumbnail) => {
                        if (generatedThumbnail) {
                            videoFiles.push({
                                title,
                                thumbnail: generatedThumbnail.replace(homeDirectory, ''),
                                video: filePath.replace(`${videoDirectory}/'`, ''),
                            });
                        }
                    });
                } else {
                    videoFiles.push({
                        title,
                        thumbnail: thumbnailPath.replace(homeDirectory, ''),
                        video: filePath.replace(videoDirectory, ''),
                    });
                }
            }
        }
    } catch (error) {
        // console.warn(`Error reading directory: ${error.message}`);
    }

    return videoFiles;
}

//create thumbnail at the background
readVideoFiles(videoDirectory)


// Function to read music files
async function readMusicFiles(directoryPath) {
    return await readFilesFromDirectory(directoryPath, supportedMusicExtensions);
}

// Function to read document files
async function readDocumentFiles(directoryPath) {
    return await readFilesFromDirectory(directoryPath, supportedDocumentExtensions);
}

// Function to read image files
async function readImageFiles(directoryPath) {
    return await readFilesFromDirectory(directoryPath, supportedImageExtensions);
}


// app.get('*', (req, res) => {
//     res.sendFile(path.join(__dirname, 'build', 'index.html'));
//   });

// Endpoint to fetch all video files with thumbnails
app.get('/read-videos', async (req, res) => {
    try {
        const videoFiles = await readVideoFiles(videoDirectory)
        res.json({
            success: true,
            videos: videoFiles,
        });
    } catch (error) {
        console.error('Error fetching videos:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching videos',
        });
    }
});

// Endpoint to fetch all music files
app.get('/read-music', async (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    try {
        const musicFiles = await readMusicFiles(musicDirectory);
        res.json({
            success: true,
            music: musicFiles,
        });
    } catch (error) {
        console.error('Error fetching music:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching music',
        });
    }
});

// Endpoint to fetch all document files
app.get('/read-documents', async (req, res) => {
    try {
        const documentFiles = await readDocumentFiles(documentDirectory);
        res.json({
            success: true,
            documents: documentFiles,
        });
    } catch (error) {
        console.error('Error fetching documents:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching documents',
        });
    }
});

// Endpoint to fetch all image files
app.get('/read-pictures', async (req, res) => {
    try {
        const imageFiles = await readImageFiles(imageDirectory);
        res.json({
            success: true,
            images: imageFiles,
        });
    } catch (error) {
        console.error('Error fetching images:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching images',
        });
    }
});


// Helper function to determine MIME type based on file extension
function getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case '.mp4': return 'video/mp4';
        case '.webm': return 'video/webm';
        case '.ogg': return 'video/ogg';
        default: return 'application/octet-stream'; // Fallback for unknown types
    }
}
app.get('/video/:videoName', (req, res) => {
    const videoName = req.params.videoName;
    const videoPath = path.join(videoDirectory, videoName);

    // Check if the file exists
    if (!fs.existsSync(videoPath)) {
        return res.status(404).send("Video not found");
    }

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;
    const contentType = getContentType(videoPath);
    const download = req.query.download === 'true'; // Use query parameter to toggle download
    const time = new Date().toISOString();
    if (!download) {
        db.run(`INSERT INTO events (type, name, action, time) VALUES (?, ?, ?, ?)`, ['video', videoName, 'Stream', time], function(err) {
            if (err) {
                console.error('Error logging stream event:', err);
            }
        });
    }
    // If the request is for download
    if (download) {
        // Set headers for downloading the file
        res.setHeader('Content-Disposition', `attachment; filename="${videoName}"`);
        res.setHeader('Content-Type', 'application/octet-stream');
        const fileStream = fs.createReadStream(videoPath);
        fileStream.pipe(res);
        fileStream.on('error', (error) => {
            console.error('File streaming error:', error);
            res.status(500).send('Error downloading the file');
        });

        // Log the download event to the database
        db.run(`INSERT INTO events (type, name, action, time) VALUES (?, ?, ?, ?)`, ['video', videoName, 'Download', time], function(err) {
           
        });

    } else if (range) {
        // Parse the range header
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        // Ensure range values are within the file size
        if (start >= fileSize || end >= fileSize) {
            res.status(416).send("Requested range not satisfiable");
            return;
        }

        const contentLength = end - start + 1;
        const fileStream = fs.createReadStream(videoPath, { start, end });

        // Partial content response
        res.writeHead(206, {
            "Content-Range": `bytes ${start}-${end}/${fileSize}`,
            "Accept-Ranges": "bytes",
            "Content-Length": contentLength,
            "Content-Type": contentType,
        });

        fileStream.pipe(res);
    } else {
        // Serve the entire file if no range is specified
        res.writeHead(200, {
            "Content-Length": fileSize,
            "Content-Type": contentType
        });

        fs.createReadStream(videoPath).pipe(res);
    }

    // Log the "Stream" event if not a download and file is being streamed
  
});



// Stream music endpoint
app.get('/stream/:musicName', (req, res) => {
    const musicName = req.params.musicName;
    const musicPath = path.join(musicDirectory, musicName);
    const time = new Date().toISOString();

    // Check if the file exists
    if (!fs.existsSync(musicPath)) {
        return res.status(404).send('Music file not found');
    }

    const stat = fs.statSync(musicPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    // Detect MIME type based on the file extension
    const mimeType = mime.lookup(musicPath) || 'application/octet-stream'; // Default to binary stream if not found

    // If there's a range request, handle it (for streaming)
    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

        const contentLength = end - start + 1;
        const file = fs.createReadStream(musicPath, { start, end });

        res.writeHead(206, {
            "Content-Range": `bytes ${start}-${end}/${fileSize}`,
            "Accept-Ranges": "bytes",
            "Content-Length": contentLength,
            "Content-Type": mimeType, // Set MIME type dynamically
        });

        file.pipe(res);
    } else {
        // If no range, serve the whole file
        res.writeHead(200, { "Content-Length": fileSize, "Content-Type": mimeType });
        fs.createReadStream(musicPath).pipe(res);
    }
    db.run(`INSERT INTO events (type, name, action, time) VALUES (?, ?, ?, ?)`, ['music', musicName, 'Stream', time], function(err) {
    });
});

// Download music endpoint
app.get('/download/:musicName', (req, res) => {
    const musicName = req.params.musicName;
    const musicPath = path.join(musicDirectory, musicName);
    const time = new Date().toISOString();

    // Check if the file exists
    if (!fs.existsSync(musicPath)) {
        return res.status(404).send('Music file not found');
    }

    // Detect MIME type based on the file extension
    const mimeType = mime.lookup(musicPath) || 'application/octet-stream'; // Default to binary stream if not found

    // Set the proper headers for download
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${musicName}"`);
    res.setHeader('Content-Length', fs.statSync(musicPath).size);

    fs.createReadStream(musicPath).pipe(res);
    db.run(`INSERT INTO events (type, name, action, time) VALUES (?, ?, ?, ?)`, ['music', musicName, 'Download', time], function(err) {
    });
});

// View document endpoint (for PDFs, DOCX, etc.)
app.get('/view/:fileName', (req, res) => {
    const { fileName } = req.params;
    const filePath = path.join(documentDirectory, fileName);
    const time = new Date().toISOString();

    if (fs.existsSync(filePath)) {
        const fileExtension = path.extname(fileName).toLowerCase();

        if (fileExtension === '.docx') {
            // If the file is a DOCX, use Mammoth to convert it to HTML
            mammoth.convertToHtml({ path: filePath })
                .then((result) => {
                    res.send(result.value); // Send the HTML result
                })
                .catch((error) => {
                    res.status(500).send('Error converting DOCX to HTML');
                    console.error(error);
                });
        } else if (fileExtension === '.pdf') {
            // For PDF, set header to display in-browser rather than download
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline; filename="' + fileName + '"');
            res.sendFile(filePath);
        } else {
            // For other file types, send the file normally
            res.sendFile(filePath);
        }
        db.run(`INSERT INTO events (type, name, action, time) VALUES (?, ?, ?, ?)`, ['document', fileName, 'View', time], function(err) {
        });
    } else {
        res.status(404).send('Document not found');
    }
});


// Download document endpoint
app.get('/document/download/:fileName', (req, res) => {
    const { fileName } = req.params;
    const filePath = path.join(documentDirectory, fileName);
    const time = new Date().toISOString();

    if (fs.existsSync(filePath)) {
        res.download(filePath); // Sends the file as a download
        db.run(`INSERT INTO events (type, name, action, time) VALUES (?, ?, ?, ?)`, ['document', fileName, 'Download', time], function(err) {
        });
    } else {
        res.status(404).send('Document not found');
    }
});


// Endpoint to view all the images
app.get('/pictures/view/:fileName', (req, res) => {
    const { fileName } = req.params;
    const filePath = path.join(imageDirectory, fileName);

    // Check if the file exists
    if (fs.existsSync(filePath)) {
        // Serve the file directly to be viewed in the browser
        res.sendFile(filePath);
       
    } else {
        // If file doesn't exist, return 404 error
        res.status(404).send('Image not found');
    }
});

//Endpoint to view 1 photo at a time
app.get('/picture/view/:fileName', (req, res) => {
    const { fileName } = req.params;
    const filePath = path.join(imageDirectory, fileName);
    const time = new Date().toISOString();

    // Check if the file exists
    if (fs.existsSync(filePath)) {
        // Serve the file directly to be viewed in the browser
        res.sendFile(filePath);
        db.run(`INSERT INTO events (type, name, action, time) VALUES (?, ?, ?, ?)`, ['picture', fileName, 'View', time], function(err) {
        });
    } else {
        // If file doesn't exist, return 404 error
        res.status(404).send('Image not found');
    }
});

// Endpoint to download the image
app.get('/picture/download/:fileName', (req, res) => {
    const { fileName } = req.params;
    const filePath = path.join(imageDirectory, fileName);
    const time = new Date().toISOString();

    // Check if the file exists
    if (fs.existsSync(filePath)) {
        // Set headers to suggest that it's a file to be downloaded
        res.download(filePath, fileName, (err) => {
            if (err) {
                res.status(500).send('Error downloading the file');
            }
        });
        db.run(`INSERT INTO events (type, name, action, time) VALUES (?, ?, ?, ?)`, ['picture', fileName, 'Download', time], function(err) {
        });
    } else {
        // If file doesn't exist, return 404 error
        res.status(404).send('Image not found');
    }
});

const UPLOAD_DIR = path.join(__dirname, 'uploads');

// Define a minimum required space for uploads
const MIN_REQUIRED_SPACE = 100 * 1024 * 1024; // Set to 100 MB for this example

// Ensure type-specific subdirectories exist
const ensureDir = (dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

// Configure multer with dynamic storage based on file type
const storage = multer.diskStorage({
    
    destination: async (req, file, cb) => {
    const time = new Date().toISOString();

        try {
            // Check available disk space
            const diskSpace = await checkDiskSpace(UPLOAD_DIR);
            if (diskSpace.free < MIN_REQUIRED_SPACE) {
                return cb(new Error('Not enough disk space to upload file'));
            }

            // Determine the folder based on file type
            let fileType = file.mimetype.split('/')[0];
            let uploadPath;

            switch (fileType) {
                case 'image':
                    db.run(`INSERT INTO events (type, name, action, time) VALUES (?, ?, ?, ?)`, ['picture', file.originalname, 'Upload', time], function(err) {});
                    uploadPath = imageDirectory;
                    break;
                case 'video':
                    db.run(`INSERT INTO events (type, name, action, time) VALUES (?, ?, ?, ?)`, ['video', file.originalname, 'Upload', time], function(err) {})
                    uploadPath = videoDirectory;
                    break;
                case 'audio':
                    db.run(`INSERT INTO events (type, name, action, time) VALUES (?, ?, ?, ?)`, ['music', file.originalname, 'Upload', time], function(err) {})
                    uploadPath = musicDirectory;
                    break;
                case 'application':
                    // Check the subtype for documents like PDFs or Word files
                    db.run(`INSERT INTO events (type, name, action, time) VALUES (?, ?, ?, ?)`, ['document', file.originalname, 'Upload', time], function(err) {})
                    const subtype = file.mimetype.split('/')[1];
                    if (['pdf', 'msword', 'vnd.openxmlformats-officedocument.wordprocessingml.document', 'txt'].includes(subtype)) {
                        uploadPath = documentDirectory
                    }
                    break;
                default:
                    uploadPath = path.join(UPLOAD_DIR, 'others');
            }

            // Ensure the directory exists
            ensureDir(uploadPath);

            // Use the determined directory for the file upload
            cb(null, uploadPath);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        // Save file with a timestamp prefix to avoid name collisions
        cb(null, `${file.originalname}`);
    },
});

const upload = multer({ storage });

// Endpoint to handle file uploads
app.post('/upload', upload.single('file'), (req, res) => {
    if (req.file) {
        res.json({ message: `${req.file.filename} uploaded successfully` });
    } else {
        res.status(400).json({ error: 'No file uploaded' });
    }
});

app.get('/events', (req, res) => {
    db.all(`SELECT * FROM events ORDER BY time DESC`, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: "Failed to retrieve events" });
        }
        res.json(rows);
    });
});

// Static middleware to serve files
app.use('/static', express.static(path.join(homeDirectory)));
app.use('/static', express.static(path.join(homeDirectory)));
app.use('/static', express.static(path.join(homeDirectory)));
app.use('/static', express.static(path.join(homeDirectory)));


// Start the server
const mainServer = app.listen(port, () => {
});

module.exports = mainServer;