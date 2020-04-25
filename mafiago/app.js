// express 기본 모듈 불러오기
var express = require('express'), 
    http = require('http'),
    path = require('path'),
    ejs = require('ejs'),
    MongoClient = require('mongodb').MongoClient,
    mongoose = require('mongoose');
    
// express 미들웨어 불러오기
var bodyParser = require('body-parser'),
    static = require('serve-static'),
    expressErrorHandler = require('express-error-handler'), // 오류 핸들러 모듈 사용
    cookieParser = require('cookie-parser'),                // 쿠키
    expressSession = require('express-session'),            // 세션
    multer = require('multer'),                             // 파일업로드
    fs = require('fs'),                                     // 파일업로드
    cors = require('cors');                                 // 다중 서버 접속 지원

var database,   // 데이터베이스 객체를 위한 변수 선언
    UserSchema, // 데이터베이스 스키마 객체를 위한 변수 선언
    UserModel;  // 데이터베이스 모델 객체를 위한 변수 선언

// 데이터베이스에 연결
function connectDB() {
    // 데이터베이스 연결 정보
    var databaseUrl = 'mongodb://root:mongodb@localhost:27017/test?authSource=admin';
    
    // 데이터베이스 연결
    console.log('데이터베이스 연결 시도');
    // MongoClient.connect(databaseUrl, function(err, db) {
    //     if (err) throw err;
    //     console.log('데이터베이스에 연결되었습니다 : ' + databaseUrl);

    //     // database 변수에 할당
    //     database = db;
    // });
    mongoose.Promise = global.Promise;
    mongoose.connect(databaseUrl);
    database = mongoose.connection;

    database.on('error', console.error.bind(console,'mongoose connection error.'));
    database.on('open',function() {
        console.log('데이터베이스에 연결되었습니다 : ' + databaseUrl);

        // 스키마 정의
        UserSchema = mongoose.Schema({
            id: {type: String, require: true, unique: true},
            password: {type: String, require: true},
            name: {type: String, index: 'hashed'},
            age: {type: Number, 'default': -1},
            created_at: {type: Date, index: {unique: false}, 'default': Date.now},
            updated_at: {type: Date, index: {unique: false}, 'default': Date.now}
        });
        // 스키마에 static 메소드 추가
        UserSchema.static('findById', function(id, callback) {
            return this.find({id : id}, callback);
        });
        UserSchema.static('findAll', function(callback) {
            return this.find({},callback);
        })
        console.log('유저 스키마 정의');

        // UserModel 정의
        UserModel = mongoose.model("users", UserSchema);
        console.log('UserModel 정의함');
    });

    // 연결이 끊어지면 5초후 재연결
    database.on('disconnected', function() {
        console.log('연결이 끊어졌습니다. 5초 후 재연결합니다.');
        setInterval(connectDB, 5000);
    })
}

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

var authUser = function(database, id, password, callback) {
    console.log('authUser 호출' + id + ', ' + password);

    // users 컬렌션 참조
    var users = database.collection('users');

    // 아이디와 비밀번호를 사용해 검색
    // UserModel.find({
    //     "id":id,
    //     "password":password
    // }, function(err, results){
    //     if(err) {
    //         callback(err, null);
    //         return;
    //     }
    //     console.log('아이디 [%s], 비밀번호 [%s]로 자용자 검색 결과', id, password);
    //     console.dir(results);
        
    //     if(results.length > 0) {
    //         console.log('id: [%s], password: [%s]가 일치하는 사용자를 찾음', id, password);
    //         callback(null, results);
    //     } else {
    //         console.log('일치하는 사용자를 찾지 못함');
    //         callback(null, null);
    //     }
    // });
    UserModel.findById(id, function(err, results) {
        if(err) {
            callback(err, null);
            return;
        }
        console.log('아이디 [%s]로 사용자 검색 결과',id);
        console.dir(results);

        if(results.length > 0) {
            console.log('아이디와 일치하는 사용자 찾음');
            if(results[0]._doc.password === password) {
                console.log('비밀번호 일치');
                callback(null, results);
            } else {
                console.log('비밀번호 일치하지 않음');
                callback(null, null);
            }
        } else {
            console.log('아이디와 일치하는 사용자를 찾지 못함');
            callback(null, null);
        }
    })
};

// 사용자를 추가하는 함수
var addUser = function(database, id, password, name, callback) {
    console.log('addUser 호출 : ' + id + ', ' + password + ', ' + name);

    // users 컬렉션 참조
    //var users = database.collection('users');

    // UserModel 인스턴스 생성
    var user = new UserModel({
        "id": id,
        "password": password,
        "name": name
    });

    // save오 저장
    user.save(function(err) {
        if(err) {
            callback(err, null);
            return;
        }
        console.log("사용자 데이터 추가");
        callback(null, user);
    });

    // id, password, username을 사용해 사용자 추가
    // users.insertMany([{
    //     "id":id,
    //     "password":password,
    //     "name":name
    // }], function(err, result) {
    //     if(err) { // 오류가 발생했을 때 콜백 함수를 호출하면서 오류 객체 전달
    //         callback(err, null);
    //         return;
    //     }

    //     // 오류가 아닌 경우, 콜백 함수를 호출하면서 결과 객체 전달
    //     if(result.insertedCount > 0) {
    //         console.log("사용자 레코드 추가 : " + result.insertedCount);
    //     } else {
    //         console.log("추가된 레코드 없음")
    //     }

    //     callback(null, result);
    // });
}
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
router.route('/process/login').post(function(req, res) {
    console.log('/process/login 처리함');

    var paramId = req.body.id || req.query.id;
    var paramPassword = req.body.password || req.query.password;
    console.log('1 : ' + paramId);
    console.log('2 : ' + paramPassword);
    if(req.session.user) {
        // 이미 로그인된 상태
        console.log('이미 로그인되어 상품 페이지로 이동합니다.');
        res.redirect('/product.html');
    }
    if(database) {
        authUser(database, paramId, paramPassword, function(err, docs) {
            if(err) {throw err;}

            if(docs) {
                console.dir(docs);

                var username = docs[0].name;
                var loginRes = '성공';

                // 세션 저장
                req.session.user = {
                    id: paramId,
                    name: username,
                    authorized: true
                }

                res.render('loginRes.ejs', {
                    userId: paramId,
                    userName: username,
                    loginRes: loginRes
                });
            } else {
                var loginRes = '실패';
                res.render('loginRes.ejs', {
                    userId: '0',
                    userName: '0',
                    loginRes: loginRes
                });
            }
        })
    }
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
    res.render('photo', {});
});
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
router.get('/adduser', (req, res) => {
    res.render('adduser', {});
});
// 사용자 추가 라우팅 함수 - 클라이언트에서 보내온 데이터를 이용해 데이터베이스에 추가
router.route('/process/adduser').post((req, res) => {
    console.log('/process/adduser 호출')

    var paramId = req.body.id || req.query.id;
    var paramPassword = req.body.password || req.query.password;
    var paramName = req.body.name || req.query.name;

    var addRes = '';

    // 데이터베이스 객체가 초기화된 경우, addUser 함수 호출하여 사용자 추가
    if(database) {
        addUser(database, paramId, paramPassword, paramName, function(err, result) {
            if(err) {throw err;}

            // 결과 객체 확인하여 추가된 데이터가 있으면 성공 응답 전송
            if(result) {
                console.log(result);
                addRes = '성공';
            } else {    // 결과 객체가 없으면 실패 응답 전송
                addRes = '실패';
            }
            res.render('addRes.ejs', {
                addRes: addRes
            });
        });
    }   // 데이터베이스 객체가 초기화되지 않은 경우 실패 응답 전송
});
router.route('/listuser').get((req, res) => {
    // 데이터베이스 객체가 초기화된경우, 모델 객체의 findAll 메소드 호출
    var getRes;
    if(database) {
        // 1. 모든 사용자 검색
        UserModel.findAll(function(err, results){
            var totalCount = results.length;
            var list = [];
            // 오류가 발생했을 때 클라이언트로 오류 전송
            if(err) {
                console.log('사용자 리스트 조회 중 오류 발생 : ' + err.stack);
                getRes = 'error';
            } else if(results) {    // 결과 객체가 있으면 리스트 전송
                console.dir(results);
                getRes = 'true';
                for(var i=0; i<results.length; i++) {
                    list[i] = results[i];
                }
            } else {                // 결과 객체가 없으면 실패 응답 전송
                getRes = 'null';
            }
            res.render('listuser', {
                getRes: getRes,
                totalCount: totalCount,
                //curId: curId,
                //curName: curName,
                list: list
            });
        })
    } else {
        getRes = 'fail';    
        res.render('listuser',{
            getRes: getRes
        });
    }
})
// router.route('/process/listuser').post((req, res) => {
//     console.log('/process/userlist 호출');

//     // 데이터베이스 객체가 초기화된경우, 모델 객체의 findAll 메소드 호출
//     if(database) {
//         // 1. 모든 사용자 검색
//         UserModel.findAll(function(err, results){
//             // 오류가 발생했을 때 클라이언트로 오류 전송
//             if(err) {
//                 console.log('사용자 리스트 조회 중 오류 발생 : ' + err.stack);

                
//             }
//         })
//     }
// })

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

    // 데이터베이스 시작
    connectDB();
});

app.set('port', process.env.PORT || 3000);
