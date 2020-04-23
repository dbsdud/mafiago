// express 기본 모듈 불러오기
var express = require('express'), 
    http = require('http'),
    path = require('path'),
    ejs = require('ejs');
    
// express 미들웨어 불러오기
var bodyParser = require('body-parser'),
    static = require('serve-static'),
    expressErrorHandler = require('express-error-handler'), // 오류 핸들러 모듈 사용
    cookieParser = require('cookie-parser'),                // 쿠키
    expressSession = require('express-session'),            // 세션
    multer = require('multer'),                             // 파일업로드
    fs = require('fs'),                                     // 파일업로드
    cors = require('cors');                                 // 다중 서버 접속 지원

    // express 객체 생성
var app = express();

// 기본 포트를 app 객체에 속성으로 설정
app.set('port', process.env.PORT || 3000);
app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({ extended: false }));    // body-parser를 사용해 applicaion/x-www-form-urlencoded 파싱
app.use(bodyParser.json()); // body-parser를 사용해 application/json 파싱
app.use('/', static(path.join(__dirname, 'views')));
app.use('/uploads', static(path.join(__dirname, 'uploads')));
app.use(cookieParser());
app.use(expressSession({
    secret: 'my key',
    resave: true,
    saveUninitialized: true
}));

app.use(cors());

// multer 미들웨어 사용: 미들웨어 사용 순서 중요 body-parser -> multer -> router
// 파일 제한: 10개, 1G
var storage = multer.diskStorage({
    destination: function (req, file, callback) {
        callback(null, 'uploads')
    },
    filename: function (req, file, callback) {
        callback(null, file.originalname + Date.now())
    }
});

var upload = multer({
    storage: storage,
    limits: {
        files: 10,
        fileSize: 1024 * 1024 * 1024
    }
});
// 미들웨어에서 파라미터 확인
// app.use(function(req, res, next) {
//     console.log('첫 번째 미들웨어에서 요청을 처리함');

//     var paramId = req.body.id || req.query.id;
//     var paramPassword = req.body.password || req.query.password;

//     res.writeHead('200', {'Content-Type':'text/html;charset=utf-8'});
//     res.write('<h1>Express 서버에서 응답한 결과입니다.</h1>');
//     res.write('<div><p>Param id : ' + paramId +'</p></div>');
//     res.write('<div><p>Param password : ' + paramPassword +'</p></div>');
//     res.end();
// });

// 라우터 객체 참조
var router = express.Router();

// 라우팅 함수 등록
// 로그인 라우팅 함수 - 로그인 후 세션 저장
router.route('/process/login/:name').post(function(req, res) {
    console.log('/process/login/:name 처리함');

    var paramName = req.params.name;

    var paramId = req.body.id || req.query.id;
    var paramPassword = req.body.password || req.query.password;

    if(req.session.user) {
        // 이미 로그인된 상태
        console.log('이미 로그인되어 상품 페이지로 이동합니다.');
        res.redirect('/product.html');
    } else {
        // 세션 저장
        req.session.user = {
            id: paramId,
            name: '소녀시대',
            authorized: true
        }
    }
    res.writeHead('200', {'Content-Type':'text/html;charset=utf-8'});
    res.write('<h1>로그인 성공</h1>');
    res.write('<div><p>Param name : ' + paramName +'</p></div>');
    res.write('<div><p>Param id : ' + paramId +'</p></div>');
    res.write('<div><p>Param password : ' + paramPassword +'</p></div>');
    res.write("<br><br><a href='/process/product'>상품 페이지로 이동하기</a>");
    res.end();
});
router.route('/process/logout').get(function(req, res) {
    if(req.session.user) {
        req.session.destroy(function(err) {
            if(err) {throw err;}
            res.redirect('/login.html');
        });
    } else {
        res.redirect('/login.html');
    }
});
router.route('/process/users/:id').get(function(req, res) {
    console.log("Get User's ID");

    // URL 파라미터 확인
    var paramId = req.params.id;

    console.log('/process/users와 토큰 %s를 이용해 처리함', paramId);

    res.writeHead('200', {'Content-Type':'text/html;charset=utf-8'});
    res.write('<h1>Express 서버에서 응답한 결과입니다.</h1>');
    res.write('<div><p>Param Id : ' + paramId + '</p></div>');
    res.end();
});
router.route('/process/showCookie').get(function(req, res) {
    console.log(req.cookies);
    res.send(req.cookies);
});
router.route('/process/setUserCookie').get(function(req, res) {
    // 쿠키 설정
    res.cookie('user', {
        id: 'mike',
        name: '소녀시대',
        authorized: true
    });

    // redirect로 응답
    res.redirect('/process/showCookie');
});
router.route('/process/product').get(function(req, res) {
    if(req.session.user) {
        res.redirect('/product.html');
    } else {
        res.redirect('/login.html');
    }
});
router.get('/photo', (req, res) => {
    res.render('photo', {

    });
})
router.route('/process/photo').post(upload.array('photo', 1), (req, res)=>{
    try {
        var files = req.files;

        var originalname = '',
            filename = '',
            mimetype = '',
            size = 0;

            if(Array.isArray(files)) {  // 배열에 들어가 있는 경우(설정에서 1개의 파일로 배열에 넣게 했음)
                console.log("배열에 들어있는 파일 갯수 : %d", files.length);

                for(var index = 0; index < files.length; index++) {
                    originalname = files[index].originalname;
                    filename = files[index].filename;
                    mimetype = files[index].mimetype;
                    size = files[index].size;
                }
            } else {
                console.log("파일 갯수 : 1");
                originalname = files[index].originalname;
                filename = files[index].filename;
                mimetype = files[index].mimetype;
                size = files[index].size;
            }
            console.log('현재 파일 정보 : ' + originalname + ', ' + filename + ', ' + mimetype + ', ' +size);

            // 클라리언트에 응답 전송
            res.render('uploadRes.ejs', {
                originalname: originalname,
                filename: filename,
                mimetype: mimetype,
                size: size
            });
        } catch(err) {
        console.log(err.stack);
    }
});
// 모든 router 처리가 끝난 후 404 오류 페이지 처리
var errorHandler = expressErrorHandler({
    static: {
        '404': './views/404.html'
    }
});

// 라우터 객체를 app 객체에 등록
app.use('/', router);
app.use(expressErrorHandler.httpError(404));
app.use(errorHandler);


http.createServer(app).listen(app.get('port'), function() {
    console.log('Start Express Server : ' + app.get('port'));
});

app.set('port', process.env.PORT || 3000);
