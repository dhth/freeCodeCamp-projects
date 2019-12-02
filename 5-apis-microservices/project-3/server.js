"use strict";

var express = require("express");
var mongo = require("mongodb");
var mongoose = require("mongoose");

var cors = require("cors");

var app = express();

var dns = require("dns");
const shortid = require("shortid");

var urlMod = require('url');
// console.log(url.parse("https://google.com").hostname);
// Basic Configuration
var port = process.env.PORT || 3000;

/** this project needs a db !! **/

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true });

var db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));

app.use(cors());

const urlSchema = new mongoose.Schema({
  originalUrl: { type: String, required: true },
  minimisedUrl: { type: String, required: true }
});

const urlModel = mongoose.model("Url", urlSchema);

/** this project needs to parse POST bodies **/
// you should mount the body-parser here
var bodyParser = require("body-parser");

app.use(bodyParser.urlencoded({ extended: false })); //for all requests

app.use("/public", express.static(process.cwd() + "/public"));

app.get("/", function(req, res) {
  res.sendFile(process.cwd() + "/views/index.html");
});

// your first API endpoint...
app.get("/api/hello", function(req, res) {
  res.json({ greeting: "hello API" });
});

app.listen(port, function() {
  console.log("Node.js listening ...");
});

//save a valid url
app.post("/api/shorturl/new", (req, res) => {
  //data received via post
  console.log(req.body.url);
  //check if url is valid

  //dns lookup doesn't take in protocol
  const REPLACE_REGEX = /^https?:\/\//i;
  // const replacedUrl = req.body.url.replace(REPLACE_REGEX, "");
  const replacedUrl = urlMod.parse(req.body.url).hostname;
  // console.log(urlMod.parse(req.body.url).hostname);
  const url = dns.lookup(replacedUrl, function(err, addresses, family) {
    if (err) {
      console.log(err);
      //invalid url
      res.json({ error: "invalid URL" });
    } else {
      // console.log(addresses);
      //save the url to the db if it doesn't already exists

      console.log("Saving to DB...");

      //find if url already saved
      urlModel.findOne({ originalUrl: req.body.url }, (err, matched) => {
        if (err) {
          res.json({ status: "Internal Error" });
        }
        if (matched) {
          // url already saved
          console.log(matched);
          res.json({
            original_url: matched.originalUrl,
            short_url: matched.minimisedUrl
          });
        } else {
          // new record
          const minimisedUrl = shortid.generate();
          const newRecord = new urlModel({
            originalUrl: req.body.url,
            minimisedUrl: minimisedUrl
          });
          newRecord.save((err, data) => {
            if (err) {
              res.json({ status: "Internal Error" });
            }
            if (data) {
              res.json({
                original_url: req.body.url,
                short_url: minimisedUrl
              });
            }
          });
        }
      });
    }
  });
});

app.get("/api/shorturl/:shortUrl", (req, res) => {
  console.log(req.params.shortUrl);
  const matchedPerson = urlModel.findOne(
    { minimisedUrl: req.params.shortUrl },
    (err, matched) => {
      if (err) {
        res.json({ status: "Internal Error" });
      }
      if (matched) {
        console.log(matched);
        res.json({
          original_url: matched.originalUrl,
          short_url: matched.minimisedUrl
        });
      } else {
        res.json({ status: "Url not found" });
      }
    }
  );
});
