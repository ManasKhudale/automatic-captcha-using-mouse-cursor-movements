    const focusArea = document.getElementById("focus-area");
    const submitBtn = document.getElementById("submit-btn");

    let cursorData = [];

    document.addEventListener("mousemove", (event) => {
        const recordTimestamp = Date.now() / 1000;  // Convert to seconds
        const clientTimestamp = performance.now() / 1000; // Convert to seconds
        const x = event.clientX;
        const y = event.clientY;
        const button = event.buttons === 1 ? "LeftButton" : event.buttons === 2 ? "RightButton" : "NoButton";
        const state = "Move";

        cursorData.push({ recordTimestamp, clientTimestamp, button, state, x, y });
    });

    document.addEventListener("mousedown", (event) => {
        const recordTimestamp = Date.now() / 1000;
        const clientTimestamp = performance.now() / 1000;
        const x = event.clientX;
        const y = event.clientY;
        const button = event.button === 0 ? "LeftButton" : event.button === 2 ? "RightButton" : "NoButton";
        const state = "Click";

        cursorData.push({ recordTimestamp, clientTimestamp, button, state, x, y });
    });

    document.addEventListener("mouseup", (event) => {
        const recordTimestamp = Date.now() / 1000;
        const clientTimestamp = performance.now() / 1000;
        const x = event.clientX;
        const y = event.clientY;
        const button = "NoButton";
        const state = "Idle";

        cursorData.push({ recordTimestamp, clientTimestamp, button, state, x, y });
    });

    submitBtn.addEventListener("click", async () => {
        console.log("Captured Cursor Data:", cursorData);

        const response = await fetch("http://localhost:5000/predict", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ cursorData })
        });

        const result = await response.json();
        console.log("Prediction Response:", result);

        document.getElementById("result-text").innerText = 
            `Prediction: ${result.prediction === 1 ? "Bot Detected 🚨" : "Human ✅"}`;
    });
