# SAMAJVED

SAMAJVED is an Expo learning app with student accounts, collaborative study tools, and a worldwide student community. Account records, whiteboard rooms, community questions, answers, saved questions, notifications, reports, and community image uploads use the existing MySQL backend.

## Start with XAMPP

1. Open the XAMPP Control Panel and start **MySQL**. Start **Apache** too if you want to use phpMyAdmin.
2. In phpMyAdmin, choose **Import**, select `backend/schema.sql`, and run it. This creates the `smart_education` database and its tables.
3. If `backend/.env` does not exist yet, copy `backend/.env.example` to `backend/.env`. Otherwise, add or update `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`, and `AUTH_SECRET` in the existing file. The usual local XAMPP defaults are `127.0.0.1:3306`, user `root`, an empty password, and database `smart_education`.
4. Set a long random value for `AUTH_SECRET` in `backend/.env` so account sessions stay valid when the backend restarts.
5. From this folder, run `npm run backend` to start the API.
6. In a second terminal, run `npm start` and open the app with Expo. For a phone, keep the phone and computer on the same Wi-Fi network.

The community tables are created automatically the first time a signed-in student opens Community. To apply them before opening the app, run `npm run db:migrate:community` after configuring `backend/.env`. The MySQL account configured for the backend needs permission to create tables. Community photos are validated and stored in MySQL (JPEG, PNG, or WebP, up to 2 MB each); no cloud storage credentials or paid upload service are required.

Create an account in the app, open **Solve together on a whiteboard**, and share the 8-character room code with friends. New strokes and clear actions sync to everyone in the room.

The app stores account passwords as salted scrypt hashes. Whiteboard and community write APIs accept changes only from signed-in accounts. Community feeds refresh periodically and are paginated; profile location and academic level remain hidden unless the student enables them. Community activity is not included in study-time statistics.

Community notifications are in-app only. The project has no push notification provider, translation service, or moderator/admin console configured yet; reports are stored for review, and original question and answer text is shown as posted.

Community reputation defaults are +2 for a question, +5 for an answer, +2 for an answer upvote, and +10 for an accepted answer. The backend can override these with `COMMUNITY_REP_QUESTION`, `COMMUNITY_REP_ANSWER`, `COMMUNITY_REP_ANSWER_UPVOTE`, and `COMMUNITY_REP_ACCEPTED` in `backend/.env`.
# Smart-Education-App
