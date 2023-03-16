
import express from 'express'
import { Server as HttpServer } from 'http'
import { Server as Socket } from 'socket.io'
import session from 'express-session'
import MongoStore from 'connect-mongo'
import Messages from './DAO/DAOmessagesMongoDB.js'
import normalizeMessages from './normalize/normalize.js'
import userLogin from './router/userLogin.js'
import homeRoute from './router/homeRoute.js'
import userReg from './router/userReg.js'
import passport from 'passport'
import routeProducts from './router/productsRouter.js'
import routeCart from './router/cartRouter.js'
import userLogout from './router/userLogout.js'
import userLoginWatcher from './middleware/userLoginWatcher.js'
import _yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import dotenv from 'dotenv'
import infoAndRandoms from './router/infoAndRandoms.js'
import cluster from 'cluster'
import * as os from 'os'
import compression from 'compression'
import routeError from './middleware/routeError.js'
import { logs } from './middleware/logs.js'

dotenv.config()

const yargs = _yargs(hideBin(process.argv))
const app = express()
const httpServer = new HttpServer(app)
const io = new Socket(httpServer)
const messages = new Messages()

app.set('view engine', 'ejs')
app.set('views', './public/views')

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static('public'))
app.use(compression())
app.use(session({
    store: MongoStore.create({
        dbName: 'sessions',
        mongoUrl: process.env.MONGOURI,
        mongoOptions: {
            useNewUrlParser: true,
            useUnifiedTopology: true
        }}),
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
        // Tiempo de expiración 10 min
        maxAge: 600000
    }
}))

passport.serializeUser((user, done) => {
    done(null, user)
  })
passport.deserializeUser((user, done) => {
    done(null, user)
})
app.use(passport.initialize())
app.use(passport.session())
// Middleware para registrar todas la peticiones recibidas
app.use(logs)
app.use('/api/productos', userLoginWatcher, routeProducts)
app.use('/api/carrito', userLoginWatcher, routeCart)
app.use('/api/login', userLogin)
app.use('/api/logout', userLogout)
app.use('/api/register', userReg)
app.use('/api/home', homeRoute)
app.use('/api/', infoAndRandoms)

// Middleware para mostrar error al intentar acceder a una ruta/método no implementados
app.use(routeError)

io.on('connection', async socket => {
    console.log('Nuevo cliente conectado!')
    // Envío listado completo de mensajes a todos los clientes conectados
    io.sockets.emit('allMessages', {
        normalizedMessages: normalizeMessages(await messages.getAll()),
        originalDataLength: JSON.stringify(await messages.getAll()).length
    })
    // Escuchando y guardando nuevos mensajes
    socket.on('newMessage', async data => {
        await messages.save(data)
        io.sockets.emit('allMessages', {
            normalizedMessages: normalizeMessages(await messages.getAll()),
            originalDataLength: JSON.stringify(await messages.getAll()).length
        })
    })
})

const { PORT, clusterMode } = yargs
    .alias({
        p: 'PORT',
        m: 'clusterMode'
    })
    .default({
        PORT: 8080,
        clusterMode: 'FORK'
    })
    .argv

if (clusterMode === 'CLUSTER' && cluster.isPrimary) {
    const CPUsQty = os.cpus().length

    console.log('SERVIDOR PRIMARIO DEL CLUSTER')
    console.log('Número de procesadores: ' + CPUsQty)
    console.log('PID:' + process.pid)

    for (let i = 0; i < CPUsQty; i++) {
        cluster.fork()
    }
    cluster.on('exit', worker => {
        console.log(`Worker ${worker.process.pid} died on ${new Date().toLocaleString()}`)
        cluster.fork()
    })
} else {
    const connectedServer = httpServer.listen(PORT, () => {
        console.log(`http server escuchando en puerto ${connectedServer.address().port}`)
    })
    connectedServer.on('error', error => console.log(`Error en servidor ${error}`))
}