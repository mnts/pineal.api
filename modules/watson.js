var watson = require('watson-developer-cloud');
var fs = require('fs');
var ytdl = require('ytdl-core');

var s2t = {
  credentials: {
    url: 'https://stream.watsonplatform.net/speech-to-text/api',
    username: '582be268-8c1b-4e8a-908d-3cf1174a71ef',
    password: 'yhTZLaksW5Eh',
    version: 'v1'
  },

  transcribe: function(file){
    var params = {
      audio: fs.createReadStream(file),
      content_type: 'audio/wav',
      continuous: 'true',
      timestamps: true
    };
     
    s2t.w.recognize(params, function(err, recEvent) {
      if(err){
        console.log('error was returned');
        console.log(err);  
      }
      else
        console.log(JSON.stringify(recEvent, null, 2));   
    });
  },

  youtube: 'http://www.youtube.com/watch?v=',
  download: function(id){
    var ws = fs.createWriteStream('audio.wav'),
        stream = ytdl(s2t.youtube+id, {
          filter: 'audioonly'
        }).pipe(ws);

    stream.on("info", function(info, format){
      log(info);
      log(format);
    });

    stream.on("response", function(httpResponse){

    });
  }
}

s2t.w = watson.speech_to_text(s2t.credentials);
 
s2t.download('a7xtsvj93qE');

return;
const exec = require('child_process').exec;

var YoutubeMp3Downloader = require('youtube-mp3-downloader');
 

var ffmpeg = "C:/lib/ffmpeg/bin/ffmpeg.exe";

var YD = new YoutubeMp3Downloader({
    "ffmpegPath": ffmpeg,        // Where is the FFmpeg binary located? 
    "outputPath": "files",    // Where should the downloaded and encoded files be stored? 
    "youtubeVideoQuality": "highest",       // What video quality should be used? 
    "queueParallelism": 2,                  // How many parallel downloads/encodes should be started? 
    "progressTimeout": 2000                 // How long should be the interval of the progress reports 
});
 
//Download video and save as MP3 file 
YD.download("a7xtsvj93qE", 'pill.wav');

var location = process.cwd().replace(/\\/g, '/');
 
YD.on("finished", function(d){
  return console.log(d);
  var file = location+'/'+d.file,
      newF = location+'/files/'+d.videoId+'.wav';
  var cmd = ffmpeg+' -i '+file+' '+newF;
  const child = exec(cmd, (error, stdout, stderr) => {
    fs.unlink(file);
    speech2text.transcribe(newF);
  });
});
 
YD.on("error", function(error) {
    console.log(error);
});


 
YD.on("progress", function(progress) {
    console.log(progress);
});