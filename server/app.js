var express = require('express'), http = require('http');

var app = express();

// 기본 포트를 app 객체에 속성으로 설정
app.set('port', process.env.POST || 3000);

http.createServer(app).listen(app.get('port'), function() {
    console.log('Start Express Server : ' + app.get('port'));
});

app.set('port', process.env.PORT || 3000);