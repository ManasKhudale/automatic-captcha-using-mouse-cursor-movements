# Automatic Captcha Using Mouse Cursor Movements

Traditional CAPTCHA mechanisms, such as text-based CAPTCHAs[3], image recognition challenges, and checkbox verifications, are becoming increasingly ineffective against modern automated attacks. Many bots can now bypass these security measures using OCR (Optical Character Recognition), AI-powered solvers[2], and CAPTCHA farms. Additionally, these CAPTCHAs often create poor user experiences, leading to frustration and accessibility issues.
This project introduces a machine learning-based alternative that authenticates users by analyzing natural cursor movement patterns instead of relying on static challenges. By tracking attributes such as:
•	Speed: The rate at which the cursor moves.
•	Timestamps: Time intervals between movements.
•	Button Presses: Patterns of clicks and interactions.
•	Path Variability: The randomness of micro-movements.
•	Jitter & Smoothness: Whether the cursor moves in a smooth or robotic manner.
The system can differentiate between human users, who exhibit irregular, organic movements, and bots, which often display linear, predictable patterns.
By implementing this approach, the project enhances security while ensuring a frictionless experience for legitimate users, eliminating the need for disruptive CAPTCHAs. 

The system now incorporates AES-256 encryption for all cursor data transmission, ensuring secure communication between client and server. Additionally, real-time prediction triggers have been implemented to evaluate bot probability on every button click, providing continuous authentication rather than single-point verification.

The database stores cursor movement data collected from both human users and bots to analyse differences in interaction behaviour. Each record[1] captures key attributes that help in detecting automated activity.
Stored Attributes:
•	Record Timestamp (s): Time elapsed since the session started, recorded by the system.
•	Client Timestamp (s): Local timestamp recorded by the user’s device at the time of the event.
•	Button State: Indicates whether a mouse button was pressed ("NoButton", "Left", or "Right").
•	Cursor Action: Defines the type of interaction ("Move", "Pressed", or "Released").
•	X-Coordinate (px): The horizontal cursor position on the screen.
•	Y-Coordinate (px): The vertical cursor position on the screen.
This data is used to compare human and bot behaviour by analysing movement characteristics like trajectory, speed, clicking patterns, and randomness. Machine learning models use these insights to classify interactions and improve security measures without disrupting the user experience.
Encrypted Data Transmission:
•	Cursor data is encrypted client-side using AES-256 before transmission
•	Server decrypts data using matching key
Continuous Evaluation:
•	Prediction model runs on every click event
•	Cumulative risk score maintained per session

1. User Table
Stores user-related information for tracking and authentication purposes.
2. Cursor Data Table
Stores mouse movement records collected from both human users and bots. This data is used for analysis and model training[3].
3. Record Timestamp
Stores the elapsed time (in seconds) since the session started, as recorded by the system. It helps in analyzing the timing and sequence of mouse movements.
4. Client Timestamp
Represents the local timestamp (in seconds) recorded by the user's device at the time of the event. This helps in tracking delays and synchronizing movement data.
5. Button State
Indicates the current condition of the mouse buttons at the recorded timestamp. Possible values:
•	"NoButton" – No mouse button is pressed.
•	"Left" – The left mouse button is pressed.
•	"Right" – The right mouse button is pressed.
6. Cursor Action
Describes the type of cursor interaction recorded at the timestamp. Possible values:
•	"Move" – Cursor is moving.
•	"Pressed" – A mouse button is pressed.
•	"Released" – A previously pressed mouse button is released.
7. X-Coordinate
Represents the horizontal position of the cursor on the screen in pixels. It helps track movement patterns along the x-axis.
8. Y-Coordinate
Represents the vertical position of the cursor on the screen in pixels. It is used to analyze movement paths along the y-axis.


![image](https://github.com/user-attachments/assets/88448f35-6e3c-4624-bdd0-3aed181be5f5)
