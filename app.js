const express = require('express');
const cors = require('cors');
const SpotifyWebApi = require('spotify-web-api-node');
const path = require('path');
const crypto = require('crypto');
const session = require('express-session');
const mongoose = require('mongoose');
const e = require('express');

const app = express();
app.use(cors());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));


const CLIENT_ID = '';
const CLIENT_SECRET = '';
const REDIRECT_URI = 'https://spotify.aranish.codes/callback';
// const REDIRECT_URI = 'http://localhost:3000/callback';
const spotifyApi = new SpotifyWebApi({
  clientId: CLIENT_ID,
  clientSecret: CLIENT_SECRET,
  redirectUri: REDIRECT_URI
});

const sessionSecret = crypto.randomBytes(32).toString('hex');

app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: true,
}));

app.use((req, res, next) => {
  if (req.session.access_token && req.session.refresh_token) {
    spotifyApi.setAccessToken(req.session.access_token);
    spotifyApi.setRefreshToken(req.session.refresh_token);
  }
  next();
});

// Uncomment this out if you want to use MongoDB (not nessecary if local use only)

// // const mongoUri = 'mongodb://localhost:27017/myapp';

// // mongoose.connect(mongoUri, {
// //   useNewUrlParser: true,
// //   useUnifiedTopology: true,
// // })
// //   .then(() => console.log('Connected to MongoDB'))
// //   .catch(err => console.error('Connection error:', err));

// // // Mongoose schema and model
// // const trackSchema = new mongoose.Schema({
// //   name: String,
// //   artist: String,
// //   album_image_url: String,
// //   is_playing: Boolean,
// //   progress_ms: Number,
// //   duration_ms: Number,
// //   timestamp: { type: Date, default: Date.now }
// // });

// // const Track = mongoose.model('Track', trackSchema);

app.get('/login', (req, res) => {
  const scopes = ['user-read-playback-state', 'user-read-currently-playing'];
  const authorizeURL = spotifyApi.createAuthorizeURL(scopes);
  const originalUrl = req.query.originalUrl || req.headers.referer || '/';
  req.session.originalUrl = originalUrl;
  res.redirect(authorizeURL);
});

app.get('/callback', async (req, res) => {
  const code = req.query.code;
  try {
    const data = await spotifyApi.authorizationCodeGrant(code);
    const { access_token, refresh_token } = data.body;
    
    req.session.access_token = access_token;
    // console.log('access_token', req.session.access_token);
    req.session.refresh_token = refresh_token;

    spotifyApi.setAccessToken(access_token);
    spotifyApi.setRefreshToken(refresh_token);

    const originalUrl = req.session.originalUrl || '/';
    delete req.session.originalUrl;
    res.redirect(originalUrl);
  } catch (err) {
    res.status(400).send('Error retrieving access token');
  }
});

app.get('/', (req, res) => {
  if (!req.session.access_token) {
    return res.render('login');
  } else {
  res.render('visualizer');
  }
});

app.get('/playing', async (req, res) => {
  const token = spotifyApi.getAccessToken();
  if (!token) {
    return res.status(201).json({ error: 'Not authenticated' });
  }

  try {
    const currentTrack = await spotifyApi.getMyCurrentPlayingTrack();
    if (!currentTrack.body || !currentTrack.body.item) {
      return res.json({ is_playing: false, track: null });
    }

    const trackData = {
      is_playing: currentTrack.body.is_playing,
      name: currentTrack.body.item.name,
      artist: currentTrack.body.item.artists[0].name,
      album_image_url: currentTrack.body.item.album.images[0].url,
      progress_ms: currentTrack.body.progress_ms,
      duration_ms: currentTrack.body.item.duration_ms
    };

    // Save track to MongoDB
    const track = new Track(trackData);
    await track.save();

    res.json(trackData);
  } catch (err) {
    console.error('Error retrieving current track');
    res.status(400).json({ error: 'Error retrieving current track' });
  }
});

app.get('/current_track', async (req, res) => {
  const token = spotifyApi.getAccessToken();
  if (!token) {
    return res.status(201).json({ error: 'Not authenticated' });
  }

  try {
    const currentTrack = await spotifyApi.getMyCurrentPlayingTrack();
    if (!currentTrack.body || !currentTrack.body.item) {
      return res.json({ is_playing: false, track: null });
    }

    const trackInfo = {
      is_playing: currentTrack.body.is_playing,
      name: currentTrack.body.item.name,
      artist: currentTrack.body.item.artists[0].name,
      album_image_url: currentTrack.body.item.album.images[0].url,
      progress_ms: currentTrack.body.progress_ms,
      duration_ms: currentTrack.body.item.duration_ms
    };

    res.json(trackInfo);
  } catch (err) {
    console.error('Error retrieving current track');
    res.status(400).json({ error: 'Error retrieving current track' });
  }
});

app.get('/audio-features', async (req, res) => {
  const token = req.session.access_token;
  // console.log('token', token);
  if (!token) {
      return res.status(401).send('Access token is missing');
  }

  try {
      const playbackData = await spotifyApi.getMyCurrentPlaybackState();
      if (playbackData.body && playbackData.body.is_playing) {
          const trackId = playbackData.body.item.id;
          const audioFeaturesData = await spotifyApi.getAudioFeaturesForTrack(trackId);
          res.json(audioFeaturesData.body);
      } else {
          res.json({ is_playing: false });
      }
  } catch (err) {
      console.error('Error retrieving audio features', err);
      res.status(429).send({err} + 'Spotify API rate limit exceeded');
      res.json({ is_playing: false });
  }
});


app.get('/nowplaying', (req, res) => {
  if (!req.session.access_token) {
    return res.render('login');
  } else {
  res.render('nowplaying');
  }
});

app.listen(3000, () => {
  console.log('Server is running on' +  REDIRECT_URI);
});
