// Embeds all your CSS into a <style> tag on page load
const styles = `
  body, html {
    margin: 0;
    padding: 0;
    overflow: hidden;
    height: 100%;
    background-color: #a7ddff;
    font-size: 40px;
  }
  .scene {
    position: relative;
    width: 100vw;
    height: 100vh;
  }
  .layer {
    position: absolute;
    width: 100%;
    height: 100%;
    pointer-events: none;
    will-change: transform;
  }
  .layer span {
    position: absolute;
    display: inline-block;
  }
`;
const sheet = document.createElement("style");
sheet.type = "text/css";
sheet.innerText = styles;
document.head.appendChild(sheet);
