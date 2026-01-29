import app from "./app";

const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

app.get("/", (_req, res) => {
  res.send("Hello World!");
});
