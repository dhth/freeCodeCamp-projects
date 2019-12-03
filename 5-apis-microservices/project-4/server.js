const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const shortid = require("shortid");
const cors = require("cors");

const mongoose = require("mongoose");
mongoose.connect(
  process.env.MONGO_URI || "mongodb://localhost/exercise-track",
  { useNewUrlParser: true, useUnifiedTopology: true }
);

app.use(cors());

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(express.static("public"));
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

app.get("/json", (req, res) => {
  res.json({ message: "Hello json" });
});

const Schema = mongoose.Schema;

const userSchema = new Schema({
  username: String,
  userid: String,
  exercises: [{ type: Schema.Types.ObjectId, ref: "Exercise" }]
});

const exerciseSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User" },
  description: String,
  duration: Number,
  date: Date
});

const UserModel = mongoose.model("User", userSchema);
const ExerciseModel = mongoose.model("Exercise", exerciseSchema);

app.post("/api/exercise/new-user", (req, res) => {
  const userName = req.body.username;
  const userId = UserModel.findOne({ username: userName }, (err, matched) => {
    if (err) {
      res.json({ status: "Internal Error" });
    }
    if (matched) {
      // url already saved
      console.log(matched);
      res.send("Username already taken");
    } else {
      // new record
      const userId = shortid.generate();
      const newRecord = new UserModel({
        username: userName,
        userid: userId
      });
      newRecord.save((err, data) => {
        if (err) {
          res.json({ status: "Internal Error" });
        }
        if (data) {
          res.json({
            username: data.username,
            userid: data.userid,
            _id: data.id
          });
        }
      });
    }
  });
});

app.post("/api/exercise/add", (req, res) => {
  let exerciseDate;
  if(!(req.body.date)){
    exerciseDate = new Date();
  }
  else{
    exerciseDate = req.body.date;
  }
  const newExercise = new ExerciseModel({
    user: req.body.userId,
    description: req.body.description,
    duration: req.body.duration,
    date: exerciseDate
  });
  
  newExercise.save((err, savedExercise) => {
    if (err) {
      res.send("Internal Server Error");
    }
    if (savedExercise) {
      UserModel.update(
        {
          _id: req.body.userId
        },
        {
          $push: {
            exercises: savedExercise._id
          }
        }
      ).exec(function(err, savedUser) {
        if (err) {
          res.send("500");
        }
        if (savedUser) {
          res.json({
            user: savedUser.id,
            description: savedExercise.description,
            duration: savedExercise.duration,
            date: new Date(savedExercise.date).toDateString()
          });
        }
      });
    }
  });
});

app.get("/api/exercise/users", (req, res) => {
  UserModel.find({}, "username", (err, data) => {
    if (err) {
      res.send("500");
    }
    if (data) {
      res.json(data);
    }
  });
});

app.get("/api/exercise/log", (req, res) => {
  const userId = req.query.userId;
  const from = req.query.from;
  const to = req.query.to;
  const limit = req.query.limit;

  let matchConditions = {};
  if (from) {
    if (!matchConditions["date"]) {
      matchConditions["date"] = {};
    }
    matchConditions["date"]["$gte"] = from;
  }
  if (to) {
    if (!matchConditions["date"]) {
      matchConditions["date"] = {};
    }
    matchConditions["date"]["$lte"] = to;
  }

  let options = {};
  if (limit) {
    options["limit"] = limit;
  }

  console.log(userId, from, to, limit);
  UserModel.findOne({ _id: req.query.userId })
    .populate({
      path: "exercises",
      select: "description duration date -_id",
      match: matchConditions,
      options: options,
    })
    .exec((err, data) => {
      res.json(
        // data
        {
          username: data.username,
          _id: data.id,
          count: data.exercises.length,
          exercises: data.exercises
        }
      );
    });
});

// Not found middleware
app.use((req, res, next) => {
  return next({ status: 404, message: "not found" });
});

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage;

  if (err.errors) {
    // mongoose validation error
    errCode = 400; // bad request
    const keys = Object.keys(err.errors);
    // report the first validation error
    errMessage = err.errors[keys[0]].message;
  } else {
    // generic or custom error
    errCode = err.status || 500;
    errMessage = err.message || "Internal Server Error";
  }
  res
    .status(errCode)
    .type("txt")
    .send(errMessage);
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
