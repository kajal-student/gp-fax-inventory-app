const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const PDFDocument = require("pdfkit");

const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

mongoose.connect("mongodb://127.0.0.1:27017/gpFaxInventory", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log("MongoDB connected"))
  .catch((err) => console.log("Mongo Error:", err));

const stockSchema = new mongoose.Schema({
  stockType: String,
  material: String,
  articleName: String,
  color: String,
  size: String,
  gender: String,
  cartons: Number,
  quantityPerCarton: Number,
  price: Number,
  sku: String,
  totalQuantity: Number,
});

const Stock = mongoose.model("Stock", stockSchema);

// Route to fetch stock data
app.get("/stock-list", async (req, res) => {
  try {
    const stocks = await Stock.find();
    let groupedStocks = {};

    stocks.forEach(stock => {
      if (!groupedStocks[stock.articleName]) {
        groupedStocks[stock.articleName] = {};
      }
      if (!groupedStocks[stock.articleName][stock.color]) {
        groupedStocks[stock.articleName][stock.color] = { material: stock.material, gender: stock.gender, sizes: {} };
      }

      groupedStocks[stock.articleName][stock.color].sizes[stock.size] = (groupedStocks[stock.articleName][stock.color].sizes[stock.size] || 0) + stock.totalQuantity;
    });

    res.json(groupedStocks);
  } catch (err) {
    res.status(500).send("Error fetching stock list");
  }
});

// Route to add stock data
app.post("/add-stock", async (req, res) => {
  const { stockType, material, articleName, color, size, gender, cartons, quantityPerCarton, price, sku } = req.body;

  const totalQuantity = cartons * quantityPerCarton;

  const newStock = new Stock({
    stockType,
    material,
    articleName,
    color,
    size,
    gender,
    cartons,
    quantityPerCarton,
    price,
    sku,
    totalQuantity
  });

  try {
    await newStock.save();
    res.send("Stock added successfully!");
  } catch (error) {
    res.status(500).send("Error adding stock");
  }
});

// Route to generate PDF with table format
app.get("/generate-pdf/:category", async (req, res) => {
  const category = req.params.category;  // Get category from the URL parameter
  let filter = {};

  // Filter stock data based on the category
  if (category === "all") {
    filter = {};
  } else if (category === "male" || category === "female" || category === "kids") {
    filter = { gender: category };
  } else if (category === "PU" || category === "EVA") {
    filter = { material: category };
  }

  const stocks = await Stock.find(filter);
  const doc = new PDFDocument();
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=${category}_Stock_Report.pdf`);

  doc.pipe(res);
  doc.fontSize(20).text("Stock Availability Report", { align: "center" });
  doc.fontSize(12).text("Generated on: " + new Date().toLocaleString());

  let yPosition = 150;

  // Table Header
  doc.fontSize(10).text("Article", 50, yPosition);
  doc.text("Color", 150, yPosition);
  doc.text("Size", 250, yPosition);
  doc.text("Gender", 350, yPosition);
  doc.text("Quantity", 450, yPosition);

  yPosition += 20;

  // Loop through the stocks and add them to the PDF in table format
  stocks.forEach(stock => {
    doc.text(stock.articleName, 50, yPosition);
    doc.text(stock.color, 150, yPosition);
    doc.text(stock.size, 250, yPosition);
    doc.text(stock.gender, 350, yPosition);
    doc.text(stock.totalQuantity.toString(), 450, yPosition);

    yPosition += 20;
    if (yPosition > 750) {
      doc.addPage();
      yPosition = 20;
    }
  });

  doc.end();
});

// Start server
const port = 3000;
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
