const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const shortid = require("shortid")
const cors = require('cors')

const mongoose = require('mongoose')
mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost/exercise-track', {useNewUrlParser:true} )

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});


const Schema = mongoose.Schema
const userSchema = new Schema({
  _id:{
    type: String,
    default: shortid.generate
  },
  username: String
})
const exerciseSchema = new Schema({
  userId: String,
  description: String,
  duration: Number,
  date: Date
})

const User = mongoose.model('User', userSchema)
const Exercise = mongoose.model('Exercise', exerciseSchema)

app.post("/api/exercise/new-user", (req, res)=>{
  
  const user = new User({username: req.body.username})
  user.save((err, user)=>{
    res.json(user.toJSON())  
  })  
  
})

app.get("/api/exercise/users", (req, res)=>{
  User.find({}, (err, users)=>{
    if (err) throw err
    res.json({users: users})
  })
})

app.use("/api/exercise/add", (req, res, next)=>{
  const {userId, description, duration, date} = req.body
  if (!userId || !description || !duration) res.send("userId, desciption and duration, must be sent")
  next()
  
}, (req, res, next)=>{
  const {duration} = req.body
  if (isNaN(duration)) res.send("Duration needs to be a number")
  else next()
})

app.use("/api/exercise/add", (req, res, next) =>{
  
  const date = new Date(req.body.date?req.body.date:Date.now())
  
  next({date: (()=>date=="Invalid Date"? false:date)()})
  
}, (date, req, res, next)=>{
  if (!date.date) res.send("Invalid Date Format")
  else{
    req.date = date.date
    next()
  }
  
})

app.use("/api/exercise/add", (req, res, next)=>{
  User.findById(req.body.userId, (err, user)=>{
    if (err) throw err
    if (user) {
      req.user = user
      next()
    }
    else res.send("User not found")
  })
})

app.post("/api/exercise/add", (req, res)=>{
  const exercise = new Exercise({
    userId: req.body.userId,
    description: req.body.description,
    duration: req.body.duration,
    date: req.date
  })
  exercise.save((err, exercise)=>{
    if (err) throw err
    res.json({user: req.user.toJSON(), exercise: exercise.toJSON()})
  })
})

app.use("/api/exercise/log", (req, res, next)=>{
  const {userId} = req.query
  User.findById(userId)
    .select("-_id -__v")
    .exec( (err, user)=>{
    if (err) throw err
    if (user) {
      req.user = user
      next()
    }
    else res.send("User not found")
  })
})


app.use("/api/exercise/log", (req, res, next)=>{
  const {from, to, limit} =  req.query
  if (limit && !isNaN(limit)) req.limit = limit
  if (from && new Date(from) == "Invalid Date") res.send("Invalid from date")
  else if (to && new Date(to) == "Invalid Date") res.send("Invalid to date")
  else{
    req.query.date = {}
    if (from) req.query.date.$gte = new Date(from)
    if (to) req.query.date.$lte = new Date(to)    
    next()
  }
}, (req, res, next)=>{
  const keys = Object.keys(req.query)
  const sKeys = []
  
  Exercise.schema.eachPath((path)=>{
    sKeys.push(path)
  })
  
  keys.forEach((i)=>{
    if (!sKeys.includes(i)) delete(req.query[i])
  })
  
  if (!Object.keys(req.query.date).length)
    delete(req.query.date)
  next()
})

app.get("/api/exercise/log", (req, res)=>{
  console.log(req.limit)
  Exercise.find(req.query)
    .select("-_id -__v -userId")
    .limit(Number(req.limit))
    .exec( (err, exercises)=>{    
    if (err) throw err
    res.json({user: req.user, count:exercises.length, log: exercises})
  })
})


const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
