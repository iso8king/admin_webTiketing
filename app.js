require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const app = express();
const session = require('express-session');
const bcrypt = require('bcrypt');

app.listen(8779 , () =>{
    console.log("app berjalan di port 8779")
})

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

app.use(session({
    secret: "4nakpadan7",
    resave: true, 
    saveUninitialized: true, 
    cookie: { secure: false , httpOnly : true} // Set secure ke true jika menggunakan HTTPS
}));



const connection = mysql.createConnection({
   host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DB,
    port: process.env.MYSQL_PORT
});

connection.connect(err => {
  if (err) {
    console.log(err);
  }
  else {
  console.log('Connected to database');
  }
});

const statusTiket = (req, res, next) => {
    Promise.all([
        new Promise((resolve, reject) => {
            connection.query("SELECT * FROM entry WHERE status='Selesai'", (err, result) => {
                if (err) return reject(err);
                resolve(result.length);
            });
        }),
        new Promise((resolve, reject) => {
            connection.query("SELECT * FROM entry where status='Belum Selesai'", (err, result) => {
                if (err) return reject(err);
                resolve(result.length);
            });
        })
    ]).then(([selesai, belumSelesai]) => {
        req.message = { done: selesai, belum: belumSelesai };
        next();
    }).catch(error => {
        console.error("Database error:", error);
        res.status(500).json({ message: "Error fetching ticket status" });
    });
};

const cekLogin = (req,res,next) => {
  if(req.session.id_pengguna && req.session){
    next();
  }else{
    // res.send('<script>alert("Pesan dari server!"); window.location.href="/";</script>');
    res.redirect('/login');
  }
}

//Routing
app.get('/' ,statusTiket,cekLogin,(req,res)=>{
    res.render('home' , {nama : req.session.nama , selesai : req.message.done , belum : req.message.belum})
})

app.get('/login' , (req,res) => {
    req.session.destroy((err) => {
      if(err){
        console.log('erro gara gara ' + err)
      }
    });
   
    res.render('login' , {message2 : req.query.messageErr});
});

app.post('/login',(req,res) => {
    const table = "admin";
    const email = req.body.username;
    const password = req.body.password;
    var sql = `SELECT * FROM ${table} WHERE email="${email}" and password="${password}"`;


    connection.query(sql,(err,result) => {
        try {
            if(result.length>0) {
                console.log(`user ${email} login`)
                req.session.email = result[0].email;
                req.session.nama=result[0].nama;
                req.session.id_pengguna = result[0].id
               res.redirect(`/`)
               


            } else{
                res.redirect('/login?messageErr=true')
            }
            
        } catch (err) {
            res.status(500)
        }
    })
})

const daysAgo = (tanggal) => {
  const tanggal_db = new Date(tanggal);
  const today = new Date();

  const jarak = today - tanggal_db;
  const hasil = Math.floor(jarak/(1000*60*60*24));

  return hasil === 0 ? "Today" : `${hasil} days ago`;
}

app.get('/tiket' ,cekLogin, (req,res) => {
     var sql = `SELECT * FROM entry`;

  connection.query(sql, (err, result) => {
    if (err) {
        console.error("Error Query 1:", err);
        return res.status(500).send("Terjadi kesalahan");
    }

    if (result.length > 0) {
        connection.query('select entry.id_tiket,entry.isi,reply.id_balasan,reply.nama_admin,reply.balasan from entry INNER join reply on entry.id_tiket = reply.id_tiket;' , (err,result2) => {
            if(result2.length>0){
                 return res.render('tiket', { data: result,data2:result2, daysAgo, user: req.session.nama , message : req.query.message});
            }
        })
    }

});
})

app.post('/balasan' , (req,res) => {
    id_tiket = req.body.tiket_id;
    balasan = req.body.balasan;

    connection.query("insert into reply (id_tiket , nama_admin , balasan) values (?,?,?)" , [id_tiket,req.session.nama,balasan] , (err,result) => {
        if(err){
            console.log(err);
            res.status(500);
        }
    })

    connection.query(`update entry set status="Selesai" where id_tiket = ?` , [id_tiket] , (err,result) => {
        if(err){
            console.log(err);
            res.status(500);
        }else{
            res.redirect('/tiket?message=true')
        }
    })


})

app.post('/editBalasan' , (req,res) => {
    id_tiket = req.body.balasan_id;
    balasan = req.body.balasan2;


connection.query("UPDATE reply SET balasan = ?,edit = 1 WHERE id_tiket = ?", [balasan, id_tiket], (err, result) => {
    if (err) {
        console.log("Error saat update:", err);
        res.status(500).send("Kesalahan dalam update data");
    } else {
        
        res.redirect('/tiket?message2=true');
    }
});


})

app.get('/logout' , (req,res) => {
    req.session.destroy;
    res.redirect('/login');
})