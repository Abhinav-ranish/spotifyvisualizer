from flask import Flask, request, jsonify, redirect
from spotipy import Spotify
from spotipy.oauth2 import SpotifyOAuth
from flask_cors import CORS
from flask import render_template
from flask import redirect

app = Flask(__name__)
CORS(app)

CLIENT_ID = 'eacc38d5400647a3bb37b451f2aa2a4e'
CLIENT_SECRET = 'a04cc40f764f463591fc55f01ae75a85'
REDIRECT_URI = 'https://016c-146-70-72-135.ngrok-free.app/callback'

sp_oauth = SpotifyOAuth(
    client_id=CLIENT_ID,
    client_secret=CLIENT_SECRET,
    redirect_uri=REDIRECT_URI,
    scope='user-read-playback-state,user-read-currently-playing'
)

@app.route('/login')
def login():
    auth_url = sp_oauth.get_authorize_url()
    return redirect(auth_url)

@app.route('/callback')
def callback():
    code = request.args.get('code')
    token_info = sp_oauth.get_access_token(code)
    return redirect('/')

@app.route('/')
def visualizer():
    return render_template('visualizer.html')

@app.route('/playing')
def playing():
    token_info = sp_oauth.get_cached_token()
    if not token_info:
        return jsonify({'error': 'Not authenticated'}), 401

    sp = Spotify(auth=token_info['access_token'])
    current_track = sp.current_user_playing_track()

    if current_track is None:
        return jsonify({'is_playing': False, 'track': None})
    
    return jsonify({'is_playing': current_track['is_playing'], 'track': current_track})

@app.route('/current_track')
def current_track():
    token_info = sp_oauth.get_cached_token()
    if not token_info:
        return jsonify({'error': 'Not authenticated'}), 401

    sp = Spotify(auth=token_info['access_token'])
    current_track = sp.current_user_playing_track()

    if current_track is None or current_track['item'] is None:
        return jsonify({'is_playing': False, 'track': None})

    track_info = {
        'is_playing': current_track['is_playing'],
        'name': current_track['item']['name'],
        'artist': current_track['item']['artists'][0]['name'],
        'album_image_url': current_track['item']['album']['images'][0]['url'],
        'progress_ms': current_track['progress_ms'],
        'duration_ms': current_track['item']['duration_ms']
    }

    return jsonify(track_info)

@app.route('/nowplaying')
def nowplaying():
    return render_template('nowplaying.html')

# @app.route('/stop')
# def stop():
#     token_info = sp_oauth.get_cached_token()
#     if not token_info:
#         return jsonify({'error': 'Not authenticated'}), 401

#     sp = Spotify(auth=token_info['access_token'])
#     sp.pause_playback()

#     return redirect('/')

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=3000, debug=True)
