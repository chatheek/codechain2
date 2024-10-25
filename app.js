const express = require('express');
const admin = require('firebase-admin');
const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword, sendEmailVerification } = require('firebase/auth');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const LessonRequest = require('./models/LessonRequest');
require('dotenv').config();

const app = express();
const serviceAccount = require('./serviceAccountKey.json');

// Firebase Admin SDK setup for server-side operations
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://blockchainclass-7c7be.firebaseio.com"
});

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Connected to MongoDB');
}).catch((error) => {
    console.error('MongoDB connection error:', error);
});

// Firebase client-side setup
const firebaseConfig = {
    apiKey: "AIzaSyCUTbujHMsEkNv9uwJFOlnTTTNiDmgxvqQ",
    authDomain: "blockchainclass-7c7be.firebaseapp.com",
    projectId: "blockchainclass-7c7be",
    storageBucket: "blockchainclass-7c7be.appspot.com",
    messagingSenderId: "800119478379",
    appId: "1:800119478379:web:9eed0e4ea17155dfe0792e",
    measurementId: "G-8ZB98CE3PB"
};

// Initialize Firebase App and Authentication
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);

// Middleware
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(cookieParser());
app.use(session({
    secret: process.env.SESSION_SECRET ,
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Middleware to check if the user is authenticated
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();
    }
    res.redirect('/login');
}

// Middleware to check admin credentials
function checkAdminCredentials(req, res, next) {
    const { username, password } = req.body;
    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
        req.session.isAdminAuthenticated = true;
        return next();
    }
    res.redirect('/admin-login');
}

// Middleware to check if the admin is authenticated
function isAdminAuthenticated(req, res, next) {
    if (req.session.isAdminAuthenticated) {
        return next();
    }
    res.redirect('/admin-login');
}

// Middleware to check lesson approval
async function checkLessonApproval(req, res, next) {
    const { day } = req.params;
    const email = req.session.user.email;

    try {
        const request = await LessonRequest.findOne({ email, day, status: 'approved' });

        if (request) {
            return next();
        }

        res.send('Your request is still pending approval.');
    } catch (error) {
        res.status(500).send('Error checking lesson approval.');
    }
}

// Routes
app.get('/', (req, res) => {
    res.render('index');
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.get('/signup', (req, res) => {
    res.render('signup');
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        req.session.user = { email: userCredential.user.email };
        res.redirect('/main');
    } catch (error) {
        res.send(`Login failed: ${error.message}`);
    }
});

app.post('/signup', async (req, res) => {
    const { email, password, confirmPassword } = req.body;
    if (password !== confirmPassword) {
        return res.send("Passwords do not match.");
    }

    try {
        const userRecord = await admin.auth().createUser({ email, password });
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(userCredential.user);
        res.send("Signup successful! Check your email for verification.");
    } catch (error) {
        res.send(`Signup failed: ${error.message}`);
    }
});

app.get('/main', isAuthenticated, async (req, res) => {
    const email = req.session.user.email;

    try {
        // Fetch all approved lesson requests for the user
        const approvedRequests = await LessonRequest.find({ email, status: 'approved' });
        
        res.render('main', { userEmail: email, approvedRequests });
    } catch (error) {
        res.status(500).send('Error retrieving approved lessons.');
    }
});


app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.send("Logout failed.");
        }
        res.redirect('/');
    });
});

// Admin login routes
app.get('/admin-login', (req, res) => {
    res.render('admin-login');
});

app.post('/admin-login', checkAdminCredentials, (req, res) => {
    res.redirect('/admin');
});

app.get('/admin', isAdminAuthenticated, async (req, res) => {
    try {
        const lessonRequests = await LessonRequest.find();
        res.render('admin', { requests: lessonRequests });
    } catch (error) {
        res.send('Failed to fetch lesson requests.');
    }
});

app.post('/admin/approve-request/:id', isAdminAuthenticated, async (req, res) => {
    const { id } = req.params;

    try {
        // Update the request status to "approved"
        await LessonRequest.findByIdAndUpdate(id, { status: 'approved' });
        res.redirect('/admin'); // Redirect back to admin panel after approval
    } catch (error) {
        res.status(500).send('Failed to approve the request. Please try again later.');
    }
});


// Lesson routes
app.post('/request-lesson/:day', isAuthenticated, async (req, res) => {
    const { day } = req.params;
    const email = req.session.user.email;

    try {
        const newRequest = new LessonRequest({ email, day });
        await newRequest.save();
        res.send('Request submitted successfully. Waiting for admin approval.');
    } catch (error) {
        res.status(500).send('Failed to submit the request. Please try again later.');
    }
});

app.get('/lesson/:day', isAuthenticated, async (req, res) => {
    const { day } = req.params;
    const email = req.session.user.email;

    try {
        // Check if the request is approved
        const request = await LessonRequest.findOne({ email, day, status: 'approved' });

        if (request) {
            // Render the lesson page with content
            res.render('lesson', { day });
        } else {
            // Show a message if the request is not approved
            res.send('Your request for this lesson is still pending approval.');
        }
    } catch (error) {
        res.status(500).send('Error retrieving lesson.');
    }
});


// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
