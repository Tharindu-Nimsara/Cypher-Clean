const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;
app.listen(PORT, () => console.log("Backend running on port", PORT));