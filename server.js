const express = require("express");
const bodyParser = require("body-parser");
const logger = require("morgan");
const mongoose = require("mongoose");
const axios = require("axios");
const cheerio = require("cheerio");


const db = require("./models");
const PORT = 3000;
const app = express();


// Use morgan logger for logging requests
app.use(logger("dev"));
// Use body-parser for handling form submissions
app.use(bodyParser.urlencoded({ extended: false }));
// Use express.static to serve the public folder as a static directory
app.use(express.static("public"));

// Set mongoose to leverage built in JavaScript ES6 Promises
// Connect to the Mongo DB
mongoose.Promise = Promise;
mongoose.connect("mongodb://localhost/nyt", {
    useMongoClient: true
});

require("./routes/html-routes.js")(app);
// Routes

// A GET route for scraping the echojs website
app.get("/scrape", (req, res) => {
    // First, we grab the body of the html with request
    axios.get("https://www.nytimes.com").then(response => {
        // Then, we load that into cheerio and save it to $ for a shorthand selector
        const $ = cheerio.load(response.data);

        // Now, we grab every h2 within an article tag, and do the following:
        $("article h2").each((i, element) => {
            // Save an empty result object
            const result = {};

            // Add the text and href of every link, and save them as properties of the result object
            result.title = $(this)
                .children("a")
                .text();
            result.link = $(this)
                .children("a")
                .attr("href");
            // result.summary = $(this)
            //     .parent().children("p.summary")
            //     .text();

            // Create a new Article using the `result` object built from scraping
            db.Article
                .create(result)
                .then(dbArticle => {
                    // If we were able to successfully scrape and save an Article, send a message to the client
                    res.send("Scrape Complete");
                })
                .catch(err => {
                    // If an error occurred, send it to the client
                    res.json(err);
                });
        });
    });
});

// Route for getting all Articles from the db
app.get("/articles", (req, res) => {
    // Grab every document in the Articles collection
    db.Article
        .find({})
        .then(dbArticle => {
            // If we were able to successfully find Articles, send them back to the client
            res.json(dbArticle);
        })
        .catch(err => {
            // If an error occurred, send it to the client
            res.json(err);
        });
        
});

// Route for grabbing a specific Article by id, populate it with it's note
app.get("/api/notes/:id", (req, res) => {
    // Using the id passed in the id parameter, prepare a query that finds the matching one in our db...
    db.Article
        .findById(req.params.id)
        // ..and populate all of the notes associated with it
        .populate("notes")
        .then(dbArticle => {
            // If we were able to successfully find an Article with the given id, send it back to the client
            res.json(dbArticle);
        })
        .catch(err => {
            // If an error occurred, send it to the client
            res.json(err);
        });
});


app.delete("/api/article/:id", (req, res) => {
    db.Article.remove({
        "_id": req.params.id
      }, function(error, removed) {
        // Log any errors from mongojs
        if (error) {
          console.log(error);
          res.send(error);
        }
        // Otherwise, send the mongojs response to the browser
        // This will fire off the success function of the ajax request
        else {
          console.log(removed);
          res.send(removed);
        }
      });
})

// Route for saving/updating an Article's associated Note
app.post("/api/notes/", (req, res) => {
    // Create a new note and pass the req.body to the entry
    db.Note
        .create(req.body)
        .then(dbNote => {
            // If a Note was created successfully, find one Article with an `_id` equal to `req.params.id`. Update the Article to be associated with the new Note
            // { new: true } tells the query that we want it to return the updated User -- it returns the original by default
            // Since our mongoose query returns a promise, we can chain another `.then` which receives the result of the query
            return db.Article.findOneAndUpdate({ _id: req.body._id }, { notes: dbNote._id }, { new: true });
        })
        .then(dbArticle => {
            // If we were able to successfully update an Article, send it back to the client
            res.json(dbArticle);
        })
        .catch(err => {
            // If an error occurred, send it to the client
            res.json(err);
        });
});

// Start the server
app.listen(PORT, () => {
    console.log("App running on port " + PORT + "!");
});
