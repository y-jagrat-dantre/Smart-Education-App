# PROJECT: Upgrade My Existing Study App and Fix All Reported Issues

I have an existing study application with learning tools, a community, a books and notes library, a whiteboard, and AI-powered learning features.

I want you to implement the following improvements directly in my existing project:

1. Integrate NCERT books using the official links I will provide.
2. Replace the existing educational video-generation experience with AI-generated images illustrating scenes from the learning content.
3. Fix the Community feature, which currently shows errors such as "Cloud could not load" and "Route not found."
4. Fix the Whiteboard Study Guide, which currently keeps loading and never provides an answer.

**IMPORTANT: Do not rebuild the application from scratch. First inspect the existing codebase, identify the actual causes of these problems, and implement reliable fixes. Preserve existing functionality, authentication, database integrations, design, and user data.**

Do not simply change error messages, add loading animations, or create mock screens. Fix the underlying functionality.

---

# PART 1: NCERT BOOK INTEGRATION

## 1. Integrate the NCERT Links I Will Provide

I will provide the NCERT book links that I want to use in the application.

Build the integration so I can add these links to the existing Books & Notes Library.

Do not invent NCERT URLs or substitute unrelated resources for the links I provide.

### Requirements

- Accept the NCERT URLs I provide.
- Associate each resource with its correct class, subject, book title, language, and chapter information where available.
- Display the book in the appropriate category.
- Allow users to open the resource from inside the application.
- Display the complete book, not just an introductory page or a small preview.
- Preserve the original PDF's page order and formatting.
- Support page navigation, zooming, and full-screen reading where the viewer allows it.
- Allow users to resume reading from their previous page.
- Provide an option to open the original official source if the embedded reader cannot display the document.
- Show useful loading and error states.
- Do not mark a book as available until its source has been verified.

### Full-Book PDF Viewer

When a student selects an NCERT book, open a dedicated reading screen.

The screen should include:
- Book title.
- Class and subject.
- Current page and total page count, when available.
- Previous and next page controls.
- Page-number navigation.
- Zoom controls.
- Full-screen reading mode.
- Search within the PDF, where supported.
- Bookmark option.
- Last-read-page restoration.
- Clear loading and error messages.

If the provided link points to a webpage containing multiple chapter links rather than a single PDF, inspect the page structure and determine how to present the complete book or its chapters.

Do not assume that every link directly returns a PDF.

### Link Handling

When processing an NCERT URL:
1. Determine whether it points to a PDF, a book page, or a chapter page.
2. Check whether the document can be accessed from the application.
3. Determine whether embedding is permitted and technically supported.
4. Use the original official source whenever possible.
5. If embedding fails, provide a reliable external-open option.

Do not bypass access controls, website restrictions, or copyright protections.

If a link cannot be accessed, explain the problem and identify the information needed to resolve it.

### Admin Management

If the application has an admin dashboard, add a section to manage NCERT resources.

Authorized administrators should be able to:
- Add a book URL.
- Edit the title and metadata.
- Assign a class and subject.
- Set the language.
- Add chapter information.
- Test whether the link works.
- Publish or unpublish the resource.
- Remove broken links.

Use the existing database and authorization system.

Do not hardcode every book directly into UI components.

---

# PART 2: REPLACE VIDEO GENERATION WITH AI-GENERATED SCENE IMAGES

My study application currently includes a feature that uses educational content to generate a video.

I want to change this experience so that, instead of generating a video, the application generates a sequence of relevant images illustrating the content.

**The objective is to help students visualize what they are learning through educational scenes, diagrams, and illustrations without requiring video generation.**

Do not simply display unrelated stock images or use random images as substitutes for generated content.

## 1. Content-to-Image Generation Workflow

Allow students to provide educational content through the existing supported input methods, such as:
- Text.
- Uploaded notes.
- PDF documents.
- A selected chapter or topic.
- Other existing learning inputs.

First analyze the content and identify the main concepts, events, processes, or scenes that can be illustrated visually.

Then generate a suitable sequence of images.

For example, if the content explains Newton's laws of motion, the generated images might illustrate:
1. An object at rest.
2. A force acting on an object.
3. The relationship between force, mass, and acceleration.
4. An action-and-reaction example.

For a history lesson, images might illustrate important historical events in chronological order.

For a biology lesson, images might illustrate the stages of a biological process.

For a story or literature lesson, images might illustrate the important scenes and events.

The generated images must be relevant to the actual content.

## 2. Scene Planning

Before generating images, create a scene plan based on the supplied educational material.

For each scene, determine:
- Scene number.
- Scene title.
- Concept being explained.
- Short description.
- Visual composition.
- Relevant characters, objects, or scientific structures.
- Connection to the original content.

Generate an appropriate number of scenes based on the amount and complexity of the material.

For a short passage, a few images may be sufficient. For a longer chapter, allow the student to select the number of scenes or generate them in manageable batches.

Do not create excessive images for short content.

## 3. Image Generation

Use the image-generation service or model supported by the existing application.

Requirements:
- Generate images based on the scene plan.
- Maintain visual consistency across related scenes.
- Use educationally appropriate compositions.
- Make scientific diagrams and illustrations understandable.
- Use appropriate historical and contextual details.
- Avoid unnecessary decorative elements.
- Ensure generated images are suitable for students.
- Handle image-generation failures gracefully.
- Show progress while images are being generated.
- Allow the student to retry failed scenes.

If multiple images represent the same characters or setting, maintain reasonable consistency across those images.

Do not invent facts that contradict the source material.

## 4. Scene Gallery and Viewer

After generation, display the results in an attractive scene gallery.

Include:
- Scene thumbnails.
- Scene titles.
- Scene numbers.
- A large image viewer.
- Previous and next scene navigation.
- Full-screen image viewing.
- Regenerate Image option.
- Download Image option, where supported.
- Save to Library option, where supported.
- Regenerate All option, if practical.

Allow students to revisit previously generated scenes without generating them again unnecessarily.

Provide a clear loading state for each image.

If a scene fails to generate, preserve the successful images and allow the failed scene to be retried independently.

## 5. Optional Educational Captions

For each generated image, provide a concise caption explaining the concept shown.

Where useful, also display:
- A short explanation.
- Important terms.
- A relevant fact from the source material.
- The relationship between the image and the lesson.

Clearly distinguish explanations derived from the source content from additional AI-generated interpretation.

Avoid placing long blocks of text directly inside generated images, because image-generation models may render text incorrectly.

Display educational explanations as normal application text below the images.

## 6. Replace the Existing Video Interface

Inspect the current video-generation feature and update it rather than creating an unrelated duplicate feature.

- Replace the video-generation action with an appropriate image-generation action.
- Update labels, buttons, icons, loading states, and result screens.
- Remove video-specific UI elements that are no longer relevant to this workflow.
- Preserve the original content input and any useful content-analysis functionality.
- Preserve previously generated videos and their data unless I explicitly approve a migration or deletion.
- Keep the feature consistent with the existing application design.

Do not remove video support from unrelated features.

## 7. Image Generation Cost and Reliability

Before selecting an implementation:
- Inspect the existing AI integration.
- Check which image-generation API or model is available.
- Reuse existing services where appropriate.
- Check API pricing and rate limits.
- Avoid exposing API keys in client-side code.
- Handle timeouts and failed requests.
- Prevent accidental duplicate generation requests.
- Avoid generating the same images repeatedly when cached results can be reused.

If image generation requires an API key, account access, or paid service that is not configured, identify the missing requirement.

Do not pretend that image generation works when the necessary service is unavailable.

---

# PART 3: FIX COMMUNITY ERRORS — "CLOUD COULD NOT LOAD" AND "ROUTE NOT FOUND"

The Community feature is currently not working correctly.

I am seeing errors similar to:
- "Cloud could not load."
- "Route not found."

I want you to diagnose and fix the actual cause of these errors.

**Do not just hide the error messages or display sample questions instead.**

## 1. Inspect the Community Architecture

Inspect:
- Community screens.
- Navigation and routing.
- Backend configuration.
- Authentication.
- Database access.
- Storage access.
- API endpoints.
- Environment variables.
- Network requests.
- Security rules.
- Existing question and answer models.

Identify which layer is failing before making changes.

Do not assume that the problem is caused by the database without checking the relevant logs and code.

## 2. Fix "Route Not Found"

Investigate the exact route that is failing.

Check:
- Whether the route exists.
- Whether its name matches the navigation configuration.
- Whether the correct screen is registered.
- Whether route parameters are valid.
- Whether nested navigation is configured correctly.
- Whether deep links point to the correct destination.
- Whether a web application's routing and deployment configuration are correct.
- Whether direct navigation to a community question works.
- Whether refreshing a community URL produces a 404.

If the application uses React Native or Expo Router, verify the actual file-based route structure and installed version.

If the application uses React for the web, inspect the router and hosting configuration.

Implement the fix appropriate to the actual framework.

Do not introduce a second routing library unnecessarily.

## 3. Fix "Cloud Could Not Load"

Trace the failing request and determine whether the problem is related to:
- Incorrect backend configuration.
- An invalid API endpoint.
- Authentication failures.
- Permission-denied errors.
- Missing database records.
- Storage access problems.
- Network connectivity.
- Incorrect environment variables.
- An unavailable service.
- An invalid response format.
- An unhandled exception.

Fix the underlying problem where possible.

If the backend is temporarily unavailable, show a useful message and a Retry button.

If authentication is required, show the appropriate sign-in flow.

If a permission is missing, explain the actual configuration issue.

Do not disable security rules or make private user data publicly accessible just to make the community load.

## 4. Verify the Community's Main Features

After fixing the errors, test:
- Opening the Community screen.
- Loading the real question feed.
- Opening an individual question.
- Creating a new question.
- Uploading question images.
- Publishing answers.
- Displaying existing answers.
- Opening user profiles.
- Voting.
- Bookmarking questions.
- Navigating between community routes.
- Returning to the previous screen.
- Refreshing community pages on the web, where applicable.

Check both successful and failed network requests.

Ensure the app does not remain stuck on a loading screen if a request fails.

## 5. Improve Error Handling

Implement a consistent loading, success, and error-handling approach.

Use:
- Skeleton loaders or progress indicators.
- Empty states when no questions exist.
- Retry buttons for recoverable errors.
- Clear authentication prompts.
- Helpful permission messages.
- Proper error logging in development.
- Safe error messages in production.

Do not display raw stack traces, secret keys, access tokens, or sensitive backend information to users.

Do not convert every failure into an empty question feed, because this hides real problems.

The community must display genuine backend data.

---

# PART 4: FIX THE WHITEBOARD STUDY GUIDE THAT KEEPS LOADING

My application has a Whiteboard feature with a Study Guide function.

Currently, when I ask the Study Guide to explain something or provide an answer, it keeps loading and never returns a response.

I want you to fix this feature completely.

**The Study Guide must produce a real answer, not just display a loading animation indefinitely.**

## 1. Inspect the Existing Whiteboard and Study Guide

Before changing anything, inspect:
- Whiteboard screen and components.
- Study Guide input form.
- AI request handler.
- Backend endpoint or server-side function.
- AI provider configuration.
- Request and response formats.
- Authentication and authorization.
- Network request logic.
- Loading and error states.
- Existing whiteboard data structures.

Determine exactly where the request is getting stuck.

Possible causes to investigate include:
- The AI request is never sent.
- The request is sent to an incorrect endpoint.
- The API key is missing or invalid.
- The selected model is unavailable.
- The request format is incorrect.
- The response parser expects the wrong data structure.
- A promise never resolves.
- An exception is swallowed.
- A timeout is not handled.
- A loading state is never reset.
- The backend returns an error that the UI ignores.
- A streaming response is not handled correctly.

These are possibilities to investigate, not assumptions about the actual cause.

## 2. Repair the Study Guide Request Flow

Implement a reliable request lifecycle:

1. The student enters a question or selects relevant whiteboard content.
2. The application validates the input.
3. The application sends the request to the configured AI service.
4. The backend processes the request securely, where required.
5. The application receives and validates the response.
6. The Study Guide displays the answer.
7. The loading state ends.

If any step fails, display a useful error message.

Ensure that every request reaches a final state:
- Success.
- Failure.
- Timeout.
- Cancellation, where supported.

Do not allow the interface to remain stuck in a loading state indefinitely.

## 3. Whiteboard Context Awareness

Where appropriate, let the Study Guide use the content already present on the whiteboard.

For example:
- A written question.
- A mathematical equation.
- A diagram.
- Selected text.
- A topic specified by the student.
- Relevant uploaded study material, if supported.

The AI should use only the context that is actually available.

If the whiteboard is empty and the student has not entered a question, ask them to provide something to explain rather than sending an empty request.

If diagram interpretation is not supported by the current AI integration, do not pretend that the system can understand every diagram.

## 4. Answer Presentation

Display answers in a readable educational format.

Support, where practical:
- Headings.
- Step-by-step explanations.
- Mathematical expressions.
- Numbered lists.
- Code formatting.
- Examples.
- Short summaries.

For mathematical problems, provide a clear sequence of steps rather than only the final result.

For conceptual questions, explain the reasoning at an appropriate level.

If the student has selected a class or academic level, use that information to tailor the explanation.

Do not fabricate successful results or show a hardcoded answer when the AI request fails.

## 5. Study Guide Controls

Provide:
- Ask Question.
- Generate Explanation.
- Retry.
- Stop Generation, where supported.
- Clear Answer.
- Copy Answer.
- Insert Answer into Whiteboard, if compatible with the existing whiteboard architecture.

Disable duplicate submissions while a request is being processed, unless concurrent requests are deliberately supported.

Allow users to submit another question after the current request finishes or is cancelled.

If the AI provider supports streaming responses and the existing application can handle them reliably, display the answer progressively. Otherwise, use a standard request-response flow.

Do not introduce streaming merely for visual effect if it increases reliability problems.

## 6. Request Timeouts and Error Recovery

Implement reasonable request timeouts.

When a request fails:
- Stop the loading indicator.
- Preserve the student's question.
- Preserve existing whiteboard content.
- Show a concise explanation.
- Provide a Retry option.
- Log useful diagnostic details in development.

Handle common failures, including:
- Network errors.
- Authentication errors.
- Rate limits.
- Invalid requests.
- AI service errors.
- Timeouts.
- Unexpected response formats.

Use the actual status codes and error information when available.

Do not automatically retry indefinitely.

Avoid sending the same AI request repeatedly without the user's consent.

## 7. AI Integration and Security

Inspect the AI service already used by the application.

Reuse the existing provider where appropriate.

Do not hardcode API keys in the mobile or web client.

Do not replace the existing AI provider without a clear technical reason.

If a required API key or service configuration is missing, report that explicitly.

If the AI provider requires a backend endpoint, verify that it exists, is deployed where necessary, and accepts the correct request format.

Do not claim that the Study Guide is repaired until a real request has been completed successfully.

---

# PART 5: APPLICATION-WIDE DESIGN AND RELIABILITY AUDIT

While implementing these changes, inspect the relevant screens and correct obvious UI/UX problems.

Check:
- Inconsistent spacing.
- Misaligned buttons.
- Poor typography.
- Broken layouts.
- Overflowing content.
- Inconsistent colors.
- Unnecessary loading indicators.
- Missing error messages.
- Broken navigation.
- Buttons that do nothing.
- Unnecessary animations.
- Mobile responsiveness.
- Accessibility.
- Performance problems.

Follow the existing soft-white design system and avoid introducing a completely different visual style.

Preserve the working functionality of the rest of the application.

Do not use placeholder content to make a broken feature appear complete.

---

# PART 6: IMPLEMENTATION ORDER

Follow this order to make the work manageable.

### Phase 1: Audit the Codebase
Identify the framework, architecture, routes, AI provider, backend, storage, and relevant components.

### Phase 2: Fix the Existing Bugs
Prioritize the Community routing/backend errors and the Whiteboard Study Guide loading issue.

These are existing broken features and should be repaired before adding unnecessary new dependencies.

### Phase 3: Implement NCERT Integration
Add the resource-management workflow and full-book reader using the actual links I provide.

### Phase 4: Implement AI Scene Images
Replace the existing video-generation workflow with scene planning, image generation, and a scene gallery.

### Phase 5: Improve UI/UX
Polish the relevant screens, loading states, error handling, and navigation.

### Phase 6: Test
Verify all four major requirements and check that existing features remain functional.

### Phase 7: Report
Provide a summary of the changes.

---

# PART 7: REQUIRED TESTING

Do not consider the work complete until the following have been checked.

## NCERT
- A valid supplied link opens the intended book.
- The complete document is accessible where the source provides it.
- Page navigation works.
- Broken links produce useful errors.
- The original source remains accessible.

## AI Scene Images
- Educational content can be submitted.
- Scene descriptions are generated successfully.
- The configured image-generation service produces actual images.
- Images appear in the gallery.
- Failed images can be retried.
- The app does not generate duplicate images unnecessarily.

## Community
- The Community screen loads.
- The question feed displays real data.
- The reported cloud-loading error is resolved or its exact remaining cause is identified.
- The reported route error is resolved.
- Questions and answers can be opened.
- Existing permissions remain secure.

## Whiteboard Study Guide
- A student can submit a question.
- The AI request reaches the configured service.
- A real answer is displayed.
- Loading ends after success.
- Loading also ends after failure or timeout.
- Retry works.
- Existing whiteboard content is preserved.

## Regression Testing
- Authentication still works.
- Existing study tools still work.
- The books and notes library still works.
- The Pomodoro timer still works.
- Statistics and progress tracking still work.
- Community data is not lost.
- No new build or runtime errors have been introduced.

Run the available tests, linting, type checks, and builds. Clearly distinguish tests that were actually executed from those that still require manual testing.

---

# FINAL INSTRUCTIONS

Work directly in my existing project.

Do not merely write a plan. Implement the code changes wherever the available environment permits.

Do not rebuild the application from scratch.

Do not delete existing user data.

Do not replace real functionality with mock data.

Do not hide the Community errors without fixing their cause.

Do not leave the Study Guide stuck in an infinite loading state.

Do not generate fake NCERT links.

Do not claim AI image generation works unless it is connected to a functioning image-generation service.

If something cannot be completed because I need to provide a link, configure an API key, enable a service, or deploy a backend, explain precisely what is missing and what I need to do.

At the end, provide:
1. The root cause of each existing bug, if identified.
2. The changes implemented.
3. The files modified.
4. Any dependencies added.
5. The tests actually performed and their results.
6. Any remaining setup requirements.

The goal is to make my existing study app more reliable, visually polished, and genuinely useful for students.