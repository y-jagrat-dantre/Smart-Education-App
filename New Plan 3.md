# PROJECT: Build a Worldwide Learning Community Inside My Existing Study App

I have already developed a study application. Now I want to add a powerful, interactive, worldwide student community where students can ask questions, upload images of questions, receive answers from other students, discuss academic topics, and learn collaboratively.

The community should feel like a combination of an educational discussion forum, a question-and-answer platform, and a modern student social network.

**IMPORTANT:** First inspect my existing application, its architecture, navigation, authentication, database, storage system, and design. Implement the community as a fully integrated feature inside the existing application.

Do not rebuild the app from scratch, remove existing functionality, or break the existing study timer, statistics, progress tracking, AI learning tools, or other features.

The community must use real backend data and support genuine interactions between users. Do not create a static UI or a fake demonstration.

# 1. Community Home Page

Create a new main navigation section called **Community**.

Design a clean, modern community feed where students worldwide can discover questions, answers, and academic discussions.

### Community Feed

Each question post should display:
- User profile picture.
- Username.
- Country or region, if the user chooses to share it.
- Time of publication.
- Question title.
- Question description.
- Uploaded question images, if any.
- Subject and topic tags.
- Number of answers.
- Number of upvotes.
- Number of views, if tracked reliably.
- Bookmark button.
- Share button.
- Report button.

Provide feed filters:
- For You.
- Latest.
- Trending.
- Unanswered.
- Most Upvoted.
- Following.

Allow users to sort questions by recent activity or popularity.

The feed should update when new questions or answers are published, using the real-time capabilities of the existing backend where appropriate.

Implement pagination or efficient incremental loading instead of downloading every post at once.

# 2. Ask a Question — Text and Image Upload

This is one of the most important features.

Create an attractive and easy-to-use **Ask a Question** interface.

Allow students to ask questions using text, images, or both.

### Question Editor

Include the following fields:

**Question Title**
- A clear title describing the problem.
- Required field.
- Sensible character limit.

**Question Description**
- A detailed explanation of the question.
- Optional when a sufficiently clear title and image are provided.
- Support multiline text.

**Upload Question Images**
- Allow users to select images from their gallery.
- Support taking a photograph using the device camera where available.
- Allow multiple images per question.
- Display image previews before publishing.
- Allow users to remove or replace selected images.
- Provide image compression where appropriate.
- Validate file types and file sizes.
- Show upload progress.
- Handle failed uploads and retries.

**Subject Selection**
Provide relevant categories such as:
- Mathematics.
- Physics.
- Chemistry.
- Biology.
- Computer Science.
- English.
- History.
- Geography.
- Economics.
- Law.
- General Knowledge.
- Other.

Allow additional categories to be added without rewriting the entire feature.

**Academic Level**
Allow users to optionally specify:
- Primary School.
- Middle School.
- Secondary School.
- Higher Secondary.
- Undergraduate.
- Postgraduate.
- Competitive Examinations.
- Other.

**Topic Tags**
Allow users to add relevant tags.

### Publishing

When the user presses "Post Question":
1. Validate the question.
2. Upload selected images to the existing storage system.
3. Create the question record in the database.
4. Associate the post with the authenticated user.
5. Publish the question.
6. Show a success message.
7. Open the newly published question or return to the feed.

If an image upload fails, provide a clear error message and a retry option.

Avoid creating duplicate questions when the user accidentally presses the publish button multiple times.

Never expose private storage credentials or unrestricted upload permissions.

# 3. Image-Based Question Solving

Students frequently have questions in the form of textbook photographs, handwritten equations, worksheets, diagrams, and examination problems.

Build the community to handle these naturally.

### Image Viewer

When a question contains an image:
- Display an appropriately sized preview.
- Allow users to tap the image to view it full-screen.
- Support zooming and panning.
- Support multiple images in a single question.
- Preserve image quality sufficiently for reading mathematical expressions and diagrams.
- Show helpful placeholders while images load.
- Handle unavailable images gracefully.

### Image-Based Answers

Allow respondents to upload images in their answers as well.

Examples include:
- Photographs of handwritten solutions.
- Mathematical working.
- Diagrams.
- Chemistry structures.
- Physics diagrams.
- Annotated explanations.

Allow text and images to be combined in one answer.

Do not require users to type out a question that is already clearly visible in their uploaded photograph.

If AI image analysis already exists in the app, consider integrating an optional "Help Me Understand This Image" feature. Keep AI-generated explanations separate from community answers and clearly label them.

Do not introduce paid AI APIs or additional services without checking their cost and compatibility first.

# 4. Question Details and Answering System

When a user opens a question, display a dedicated question-detail screen.

### Question Section
Display:
- Complete question title.
- Description.
- Uploaded images.
- Author information.
- Subject and topic tags.
- Publication date.
- Upvote count.
- Bookmark control.
- Share control.
- Report option.

### Answer Editor

Allow students to submit answers containing:
- Text.
- Mathematical expressions, where practical.
- Images.
- Explanations and step-by-step solutions.

Provide a clean editor with readable formatting.

Where appropriate, support:
- Headings.
- Numbered steps.
- Bulleted lists.
- Code blocks for programming questions.
- LaTeX-style mathematical expressions.

Do not make the answer editor unnecessarily complicated on mobile devices.

### Answer Cards

Each answer should display:
- Respondent's profile.
- Answer text.
- Attached images.
- Upvote count.
- Publication time.
- Reply option.
- Report option.

Allow the question author to mark one answer as the **Accepted Answer**.

Display accepted answers prominently.

Only the question author or an authorized moderator should be able to mark an answer as accepted.

For an unanswered question, display a helpful message such as:

"No answers yet. Be the first to help!"

# 5. Replies and Discussions

Create a threaded discussion system.

Users should be able to:
- Reply to answers.
- Ask for clarification.
- Discuss a solution.
- Respond to comments.
- Edit their own content where permitted.
- Delete their own content, subject to appropriate retention and moderation rules.

Display replies in a readable, nested format.

Limit excessive nesting to keep the interface usable on mobile screens.

Provide pagination or incremental loading for questions with many answers and replies.

Use real database records rather than storing discussion content only in local application state.

# 6. Voting and Community Reputation

Build a fair reputation system that encourages helpful educational contributions.

### Voting
Allow authenticated users to:
- Upvote useful questions.
- Upvote helpful answers.
- Remove their own vote.

Prevent users from voting repeatedly on the same item.

Do not allow users to manipulate vote counts by repeatedly pressing a button or creating duplicate requests.

If downvotes are introduced, make them optional and avoid designs that encourage harassment or unnecessary hostility.

### Reputation Points

Award points for meaningful contributions.

Example scoring system:
- Ask a valid question: +2 points.
- Publish a useful answer: +5 points.
- Receive an upvote on an answer: +2 points.
- Receive an accepted answer: +10 points.
- Help another student solve a problem: earn points through the relevant answer activity.

Treat these values as configurable defaults.

Do not award points for repeated spam, duplicate posts, or self-voting.

Prevent users from repeatedly earning points by deleting and reposting the same content.

Where the backend supports it, calculate reputation changes through secure, transactional server-side logic rather than trusting values submitted by the client.

### User Levels

Create optional reputation levels such as:
- Beginner.
- Learner.
- Contributor.
- Scholar.
- Expert.

Display a user's level on their profile and community contributions.

Do not label a user an academic expert solely because they have accumulated points. Make it clear that these levels reflect community participation, not verified qualifications.

# 7. Student Profiles

Create a community profile for every participating user.

Include:
- Profile picture.
- Display name.
- Optional biography.
- Optional country or region.
- Subjects of interest.
- Academic level, if shared.
- Reputation points.
- Community level.
- Questions asked.
- Answers submitted.
- Accepted answers.
- Recent contributions.

Allow users to edit their own profile.

Provide privacy settings that let users control which optional profile details are visible.

Do not expose email addresses, authentication identifiers, or other private account details publicly.

# 8. Search and Discovery

Implement a powerful community search.

Allow users to search by:
- Question title.
- Question description.
- Subject.
- Topic tags.
- User display name.
- Answer content, where supported.

Add useful filters:
- Subject.
- Academic level.
- Answered or unanswered.
- Most recent.
- Most upvoted.

Show relevant results with clear loading and empty states.

Use efficient database queries and indexing supported by the existing backend.

Do not claim that the system searches image contents unless OCR or image indexing has actually been implemented.

# 9. Worldwide Community Features

Make the community useful for students from different countries.

### Language Support
- Allow questions and answers in different languages.
- Display the original text as submitted.
- Add an optional translation action if a suitable translation service is already available or can be integrated affordably.
- Clearly label translated content.
- Never silently replace the original answer with a translation.

### Global Discovery
- Let students discover questions from different regions.
- Offer subject-based and topic-based feeds.
- Support optional country and language filters.
- Do not force users to disclose their location.

### Time and Dates
Display publication times in a readable local format.

Handle time zones consistently using appropriate timestamps.

Do not assume all students follow the same academic calendar or curriculum.

# 10. Notifications

Create a notification system for meaningful community activity.

Notify users when:
- Someone answers their question.
- Someone replies to their answer.
- Someone comments on their question.
- Someone upvotes their answer, if enabled.
- Their answer is accepted.
- Someone mentions them in a discussion, if mentions are supported.

Include:
- In-app notifications.
- Read and unread states.
- Mark-as-read controls.
- A notification settings screen.
- Deep links to the relevant question or answer.

Avoid sending repeated notifications for the same event.

Respect user notification preferences.

If push notifications require additional platform configuration, implement the supported parts and document the remaining setup rather than pretending push notifications already work.

# 11. Bookmarks and Saved Questions

Allow users to save useful questions for later.

Features:
- Bookmark a question.
- Remove a bookmark.
- View saved questions.
- Organize saved questions by subject, where practical.
- Open a saved question directly.
- Preserve bookmarks across devices when the backend supports account synchronization.

Bookmarks must be private to the user unless the user explicitly shares a collection.

# 12. Trending and Unanswered Questions

Create dedicated discovery sections.

### Trending Questions
Identify questions receiving meaningful engagement.

Use a reasonable ranking method based on factors such as:
- Recent activity.
- Upvotes.
- Answers.
- Time since publication.

Avoid ranking solely by total views.

Prevent the feed from being dominated indefinitely by old posts.

### Unanswered Questions
Display questions that have not received an answer.

Allow users to filter unanswered questions by subject.

Encourage students to contribute where they can genuinely help.

# 13. Community Moderation and Safety

Because the community is available worldwide, implement basic moderation and abuse prevention.

Include:
- Report Question.
- Report Answer.
- Report Comment.
- Block User.
- Hide or mute unwanted interactions where practical.
- Spam prevention.
- Duplicate submission prevention.
- Rate limits for posting and voting.
- Basic profanity and abuse detection, where feasible.
- Moderator review tools if an admin system already exists.

Allow users to report:
- Spam.
- Harassment.
- Inappropriate content.
- Misleading academic answers.
- Copyright concerns.
- Other violations.

Reports should be stored securely and accessible only to authorized moderators.

Do not automatically delete legitimate educational discussions merely because someone disagrees with an answer.

Make moderation decisions reviewable where appropriate.

# 14. Database and Backend Integration

First inspect the application's current backend and storage.

Reuse the existing infrastructure whenever possible.

If the app uses Firebase:
- Use the existing authentication system.
- Store question, answer, comment, vote, bookmark, and notification records in the appropriate database.
- Store uploaded images in the existing supported storage service.
- Use database security rules to enforce permissions.
- Validate ownership and allowed operations.
- Use efficient pagination and indexes.
- Protect against duplicate votes and unauthorized edits.
- Avoid exposing administrative credentials.

If the app uses Supabase:
- Use the existing authentication and database.
- Store images in appropriately secured storage buckets.
- Apply Row Level Security policies.
- Validate ownership and permitted operations.

If another backend is used, follow its established architecture.

### Suggested Data Models

Design suitable data structures for:

**Users**
- User ID.
- Display name.
- Profile picture.
- Optional profile information.
- Subjects of interest.
- Reputation.

**Questions**
- Question ID.
- Author ID.
- Title.
- Description.
- Image references.
- Subject.
- Academic level.
- Tags.
- Creation timestamp.
- Updated timestamp.
- Answer count.
- Vote information.
- Accepted answer ID, if applicable.

**Answers**
- Answer ID.
- Question ID.
- Author ID.
- Text content.
- Image references.
- Creation timestamp.
- Updated timestamp.
- Vote information.
- Accepted status.

**Comments**
- Comment ID.
- Parent question or answer reference.
- Author ID.
- Content.
- Creation timestamp.

**Votes**
- User ID.
- Target item ID.
- Target item type.
- Vote value.
- Creation timestamp.

**Bookmarks**
- User ID.
- Question ID.
- Creation timestamp.

**Notifications**
- Recipient ID.
- Event type.
- Relevant question or answer ID.
- Read status.
- Creation timestamp.

**Reports**
- Reporter ID.
- Target content reference.
- Reason.
- Description.
- Status.
- Creation timestamp.

These are conceptual models. Adapt them to the database architecture that already exists.

Avoid unnecessary duplication of counters or derived data.

Ensure that security rules prevent users from modifying other users' content or directly manipulating reputation and accepted-answer status.

# 15. Image Storage and Upload Reliability

Image uploads are essential to this feature.

Implement:
- Image previews.
- Multiple image selection.
- File-type validation.
- File-size limits.
- Image compression.
- Upload progress.
- Retry handling.
- Graceful error states.
- Secure image access where appropriate.
- Cleanup of abandoned uploads when safely possible.

Support common image formats such as JPEG, PNG, and WebP where supported by the platform.

Do not allow arbitrary executable files to be uploaded as question images.

Make sure uploaded images are readable on both mobile and desktop screens.

Do not place private API keys or service account credentials inside the client application.

# 16. UI/UX Design

Make the community feel like a natural extension of the existing study app.

Follow the existing design system.

Use:
- A clean soft-white theme.
- Consistent typography.
- Comfortable spacing.
- Rounded cards.
- Subtle borders and shadows.
- Accessible contrast.
- Modern icons.
- Smooth, purposeful animations.
- Responsive layouts.
- Attractive image galleries.
- Clear empty and loading states.

### Suggested Community Navigation

Community home:
- Search bar.
- Ask Question button.
- Feed filters.
- Question feed.
- Floating Ask Question button on mobile, where appropriate.

Question details:
- Question content.
- Image gallery.
- Voting and bookmarking.
- Answers.
- Answer editor.
- Threaded discussions.

Profile:
- User information.
- Reputation.
- Questions.
- Answers.
- Accepted answers.

Saved:
- Bookmarked questions.

Notifications:
- Recent community activity.

Keep the interface simple enough for students to use comfortably.

Do not overload the screen with unnecessary statistics or decorative elements.

# 17. Connect the Community to the Existing Study App

Integrate the community with the existing learning experience.

Where appropriate:
- Allow students to open a community question from a subject or topic.
- Suggest relevant subject tags based on the current study screen.
- Allow students to ask a question about a topic they are studying.
- Provide a way to return to the original learning material.
- Allow useful community questions to be bookmarked alongside other learning resources, if the existing architecture supports it.

Do not modify the existing study timer, Pomodoro system, or learning statistics unnecessarily.

If community activity is included in the statistics dashboard, clearly distinguish community participation from actual study time.

Do not count time spent browsing community posts as active study time automatically.

# 18. Testing and Quality Assurance

Test the complete user journey.

Verify that:
1. A student can open the community.
2. A student can create a text question.
3. A student can upload a question image.
4. A student can publish a question containing both text and images.
5. Another user can view the question.
6. Another user can submit a text answer.
7. Another user can submit an image-based answer.
8. Students can reply to answers.
9. Voting works correctly.
10. Duplicate votes are prevented.
11. Accepted answers work correctly.
12. Bookmarks persist.
13. Search and filters work.
14. Notifications are created correctly.
15. Image uploads handle errors and retries.
16. Users cannot edit or delete another user's content without authorization.
17. Private profile information remains protected.
18. Moderation reports can be submitted.
19. The feed works with a large number of posts using pagination.
20. Existing study-app features continue to work.

Run the available tests, type checks, linting, and builds.

Fix errors introduced by the changes.

Do not claim that tests passed unless they were actually executed.

# 19. Implementation Plan

Follow this order:

**Phase 1: Project Audit**
Understand the existing architecture, authentication, database, storage, navigation, and design.

**Phase 2: Community Foundation**
Implement the community feed, question publishing, database integration, and image uploads.

**Phase 3: Questions and Answers**
Implement question details, image galleries, answers, comments, voting, and accepted answers.

**Phase 4: Profiles and Discovery**
Implement profiles, search, subject filters, trending questions, and unanswered questions.

**Phase 5: Engagement**
Implement bookmarks, reputation, notifications, and user interactions.

**Phase 6: Moderation and Security**
Implement reporting, permissions, rate limits, validation, and secure data access.

**Phase 7: Integration and Design**
Integrate the community with the existing app and polish the interface.

**Phase 8: Testing**
Test core workflows, image uploads, security, persistence, and compatibility.

**Phase 9: Final Report**
Summarize implemented features, modified files, database changes, dependencies, tests performed, and remaining configuration requirements.

# FINAL REQUIREMENTS

- Modify my existing project directly.
- Do not rebuild the application from scratch.
- Do not create a separate demonstration website.
- Do not replace real backend functionality with mock data.
- Do not remove existing features.
- Do not break authentication or existing database integrations.
- Use real user-generated questions and answers.
- Support image uploads in both questions and answers.
- Make the community usable on mobile and desktop.
- Prioritize security, performance, accessibility, and ease of use.
- Reuse existing infrastructure and dependencies whenever practical.
- Explain any missing backend configuration instead of pretending the feature is fully operational.

The final result should be a polished, worldwide learning community where students can ask questions using text or photographs, receive helpful answers, share solutions, and learn from one another.