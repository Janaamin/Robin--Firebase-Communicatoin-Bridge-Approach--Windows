import numpy as np
import pyaudio
import time
import geocoder
import wave
from birdnetlib import Recording
from birdnetlib.analyzer import Analyzer
from datetime import datetime
import os
import firebase_admin
from pytz import timezone #Firestore saves timestamps in UTC by default
from firebase_admin import credentials, firestore
from tensorflow.lite.python.interpreter import Interpreter

import os

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# Build the credentials object using environment variables
cred = credentials.Certificate({
    "type": os.getenv("FIREBASE_TYPE"),
    "project_id": os.getenv("FIREBASE_PROJECT_ID"),
    "private_key_id": os.getenv("FIREBASE_PRIVATE_KEY_ID"),
    "private_key": os.getenv("FIREBASE_PRIVATE_KEY").replace("\\n", "\n"),
    "client_email": os.getenv("FIREBASE_CLIENT_EMAIL"),
    "client_id": os.getenv("FIREBASE_CLIENT_ID"),
    "auth_uri": os.getenv("FIREBASE_AUTH_URI"),
    "token_uri": os.getenv("FIREBASE_TOKEN_URI"),
    "auth_provider_x509_cert_url": os.getenv("FIREBASE_AUTH_PROVIDER_CERT_URL"),
    "client_x509_cert_url": os.getenv("FIREBASE_CLIENT_CERT_URL"),
})
firebase_admin.initialize_app(cred)

# Initialize Firestore
db = firestore.client()

RATE = 44100  # Sampling rate
CHUNK = 2048  # Number of frames per buffer (increase if needed)
FORMAT = pyaudio.paInt16  # Audio format (16-bit PCM)
CHANNELS = 1  # Number of audio channels (mono)
full_data = []

# Geolocation
g = geocoder.ip('me')

# Initialize PyAudio
p = pyaudio.PyAudio()

# Open an audio stream
stream = p.open(format=FORMAT,
                channels=CHANNELS,
                rate=RATE,
                input=True,
                frames_per_buffer=CHUNK)

# Initialize variables for spectrogram
window = np.blackman(CHUNK)
noise_floor_samples = []
noise_floor_duration = 10  # seconds
noise_floor_threshold = 0  # Initialize with zero (will be updated)
in_max_power = False  # Initialize in_max_power

# Record audio for noise floor calculation
print("Calculating noise floor for 10 seconds...")
start_time = time.time()
while time.time() - start_time < noise_floor_duration:
    data = stream.read(CHUNK)
    audio_data = np.frombuffer(data, dtype=np.int16)
    noise_floor_samples.extend(audio_data)

# Compute the FFT of the audio data
noise_fft_data = np.fft.fft(noise_floor_samples)
noise_freqs = np.fft.fftfreq(len(noise_floor_samples), 1 / RATE)
noise_power_spectrum = np.abs(noise_fft_data) ** 2

# Find the frequency with the highest power
noise_max_power_index = np.argmax(noise_power_spectrum)
noise_max_freq = noise_freqs[noise_max_power_index]
noise_max_power = noise_power_spectrum[noise_max_power_index]
noise_floor_threshold = noise_max_power / 4

print(f"Noise floor threshold: {noise_floor_threshold:.2f}")

output_filename_template = "audio_samples_{count}.wav"
file_count = 0
analyzer = Analyzer()
buffer = 100

def save_and_analyze(full_data):
    global file_count
    duration = len(full_data) / RATE
    if duration > 3:
        print(duration)
        file_count += 1
        output_filename = output_filename_template.format(count=file_count)
        with wave.open(output_filename, 'wb') as output_wavefile:
            output_wavefile.setnchannels(CHANNELS)
            output_wavefile.setsampwidth(p.get_sample_size(FORMAT))
            output_wavefile.setframerate(RATE)
            output_wavefile.writeframes(full_data.tobytes())
            print(f"Audio samples saved to {output_filename}")

        recording = Recording(
            analyzer,
            output_filename,
            lat=g.latlng[0],
            lon=g.latlng[1],
            date=datetime.now(),
            min_conf=0.25,
        )
        recording.analyze()
        birds = [item['common_name'] for item in recording.detections]
        birds = list(set(birds))
        print(birds)

        # Save each bird detection to Firestore
        eastern = timezone('US/Eastern')
        current_time = datetime.now().astimezone(eastern)  # Convert to Eastern Time
        for bird in birds:
            bird_data = {
                "bird": bird,
                "latitude": g.latlng[0],
                "longitude": g.latlng[1],
                "timestamp": current_time
            }
            db.collection("birds").add(bird_data)  # Add document to Firestore
            print(f"Logged {bird} to Firestore.")
        
        os.remove(output_filename)

try:
    while True:
        try:
            data = stream.read(CHUNK, exception_on_overflow=False)
        except OSError as e:
            print(f"Stream read error: {e}")
            continue

        audio_data = np.frombuffer(data, dtype=np.int16)
        fft_data = np.fft.fft(audio_data * window)
        freqs = np.fft.fftfreq(CHUNK, 1 / RATE)
        power_spectrum = np.abs(fft_data) ** 2

        max_power_index = np.argmax(power_spectrum)
        max_freq = freqs[max_power_index]
        max_power = power_spectrum[max_power_index]

        if ((max_power > noise_floor_threshold) and (max_freq >= 1000 and max_freq <= 8000)) or (buffer < 150):
            if not in_max_power:
                buffer = 0
                in_max_power = True
            if max_power > noise_floor_threshold and (max_freq >= 1000 and max_freq <= 8000):
                buffer = 0
            print(buffer)
            full_data.extend(audio_data)
            buffer += 1
        else:
            in_max_power = False
            if full_data:
                save_and_analyze(np.array(full_data))
                full_data = []
            buffer = 100  # Reset buffer

except KeyboardInterrupt:
    print("Recording stopped by user.")
finally:
    stream.stop_stream()
    stream.close()
    p.terminate()
