# TASK: Add an Advanced Pomodoro Timer and Focus Mode to My Existing Study App

I have an existing study application. I want you to add a professional Pomodoro Timer with a dedicated Focus Mode that helps students concentrate, avoid distractions, and study effectively.

**IMPORTANT:** First inspect my existing application, understand its framework, navigation, design system, study-session tracking, statistics dashboard, and database. Integrate the new features into the existing app rather than creating a separate application.

Do not remove existing features or break existing functionality.

## 1. Pomodoro Timer

Create a beautiful, modern Pomodoro Timer screen that fits naturally into my existing study app.

### Default Timer Settings
- Focus session: 25 minutes.
- Short break: 5 minutes.
- Long break: 15 minutes.
- Long break after every 4 completed focus sessions.

Allow users to customize these durations in Settings.

### Timer Controls
Include:
- Start Focus Session.
- Pause Timer.
- Resume Timer.
- End Session.
- Skip Break.
- Restart Timer, where appropriate.

Display:
- Large countdown timer.
- Current session type.
- Selected subject and topic.
- Completed Pomodoro sessions.
- Progress ring surrounding the countdown.
- Current daily study goal progress.
- A clear indicator of whether the session is running or paused.

Use smooth, subtle animations and a clean interface.

### Timer Accuracy
- Calculate remaining time using timestamps rather than relying exclusively on repeatedly decrementing a counter.
- Prevent duplicate timers from running simultaneously.
- Handle app backgrounding and foregrounding correctly.
- Restore the correct timer state after app suspension or an unexpected restart where feasible.
- Do not count break time as active study time.
- Do not count paused time as active study time.
- Avoid adding duplicate study sessions.
- Ensure the timer cannot accidentally become negative.
- Use the existing session-tracking system if one already exists.

The timer must be reliable, not just visually attractive.

## 2. Focus Mode

Add a dedicated Focus Mode that activates when the user starts a Pomodoro focus session.

When Focus Mode is active:
- Display a distraction-free timer.
- Show the current study subject and topic.
- Hide unnecessary navigation elements where practical.
- Keep the most important timer controls accessible.
- Display motivational messages occasionally, without interrupting concentration.
- Show the remaining time clearly.
- Provide access to pause and end the session.

Example messages:
- "Stay focused. One step at a time."
- "You're making progress!"
- "Keep going. Your goal is within reach."

Do not display distracting pop-ups or unnecessary animations during active study sessions.

## 3. Warning When the User Tries to Leave an Active Session

This is a key requirement.

When a focus session is running and the user attempts to leave the timer screen, navigate to another section, press the Back button, or close the active session, show a clear warning before allowing them to leave.

### Warning Dialog

Title: "Focus Session in Progress"

Message:

"Your study session is still running. Leaving now may interrupt your focus. What would you like to do?"

Display three actions:

**1. Continue Studying**
- Close the warning.
- Keep the user on the timer screen.
- Continue the current session without resetting the timer.

**2. Pause & Leave**
- Pause the timer.
- Save the current session state.
- Navigate to the requested destination.
- Allow the user to resume the session later.

**3. End Session & Leave**
- Ask for confirmation before ending the session.
- Stop the active focus timer.
- Save the actual study duration accurately.
- Navigate to the requested destination.

### Important Behavior

- Never end a session automatically just because the user attempts to navigate away.
- Do not reset the timer when the warning appears.
- Prevent accidental navigation until the user selects an action.
- Prevent multiple warning dialogs from opening simultaneously.
- Ensure the Back button follows the same rules.
- If the user selects "Continue Studying," return them to the active timer without interruption.
- If the user selects "Pause & Leave," preserve the remaining time and session information.
- If the user selects "End Session & Leave," record the session correctly without counting paused time or break time as active study time.

Use the application's existing navigation framework to implement this behavior consistently.

## 4. Handle Attempts to Exit the Application

Implement exit warnings wherever technically supported by the application's platform.

### Android
When the user presses the Android Back button during an active focus session:
- Show the Focus Session in Progress warning.
- Do not exit immediately.
- Offer Continue Studying, Pause & Leave, and End Session & Leave.

Handle Android hardware and system Back navigation appropriately.

### Web Application
If the application runs in a browser:
- Intercept internal navigation attempts while a focus session is active.
- Show the custom warning for navigation inside the application.
- Use the browser's native `beforeunload` confirmation where supported when the user attempts to reload or close the page.
- Do not assume browsers allow fully customized exit dialogs.
- Avoid interfering with normal navigation when no focus session is active.

### React Native / Expo
If the application uses React Native or Expo:
- Use the existing navigation system and compatible BackHandler functionality.
- Handle app state changes appropriately.
- Ensure that timer state is preserved when the app goes into the background.

**Platform limitation:** Do not claim that the application can prevent users from switching apps, opening the home screen, force-closing the app, or shutting down their device. The app should warn about supported navigation attempts and preserve session data when possible, not forcibly lock the device.

## 5. Detect When the User Leaves the App

Add an optional distraction-awareness feature.

When the user starts a focus session:
- Monitor whether the application moves into the background, where the platform permits this.
- Record the time the app enters the background.
- Record when the user returns.
- Calculate the duration spent away from the app.

When the user returns after leaving the app during a running focus session, show a subtle notification:

Example:

"Welcome back! You were away for 2 minutes and 15 seconds. Your focus session is still running."

Provide options:
- Resume Focus.
- Pause Session.
- End Session.

### Rules
- Ask for permission before enabling optional notifications.
- Do not access other applications' content.
- Do not attempt to identify which app the user opened.
- Do not record sensitive device activity.
- Do not automatically mark every background transition as intentional distraction.
- Distinguish between an app going into the background and the user deliberately navigating away.
- Allow users to disable distraction-awareness notifications in Settings.

The purpose is to encourage focus, not to monitor users invasively.

## 6. Pomodoro Session Notifications

Add optional notifications for important timer events.

Examples:
- "Your focus session has started."
- "Your Pomodoro session is complete!"
- "Time for a short break."
- "Your break is over. Ready to focus again?"
- "You've completed four focus sessions. Enjoy your long break!"

Requirements:
- Request notification permission when necessary.
- Use platform-compatible local notifications.
- Cancel or update scheduled notifications when the timer is paused, restarted, or ended.
- Avoid duplicate notifications.
- Respect notification settings.
- Handle notification permissions being denied.
- Do not rely on JavaScript timers continuing to run indefinitely in the background.

If the platform supports reliable scheduled local notifications, use them to notify users when a timer finishes in the background.

## 7. Automatic Study Statistics Integration

Integrate the Pomodoro Timer with the existing Statistics and Progress dashboard.

Track:
- Total Pomodoro sessions started.
- Completed focus sessions.
- Abandoned or interrupted sessions, if relevant.
- Total active focus time.
- Daily focus time.
- Weekly focus time.
- Average focus session duration.
- Subject-wise focus time.
- Completed short breaks.
- Completed long breaks.
- Daily focus goals.
- Focus-session completion rate.

Ensure statistics use actual recorded activity.

### Session Completion Rules
- Count a Pomodoro as completed only when the focus timer reaches zero naturally.
- Do not mark manually ended sessions as completed Pomodoros.
- Record partial sessions separately.
- Do not include breaks or paused time in active study duration.
- Avoid double-counting time already recorded by the existing study timer.
- Ensure the session is saved only once.

If an existing study timer is available, determine whether it should share the same session-tracking service rather than creating a second independent tracking system.

## 8. Break Experience

When a focus session finishes, display a completion screen.

Example:

"Focus Session Complete!"

Display:
- Time studied.
- Subject studied.
- Number of Pomodoros completed today.
- Daily goal progress.

Offer:
- Start Short Break.
- Start Long Break, when appropriate.
- Continue Studying.
- Finish for Now.

During breaks, show:
- Remaining break time.
- A simple suggestion to stretch, rest your eyes, drink water, or move around.
- A button to skip the break.
- A button to finish the session.

Do not count break time as study time.

After the break finishes, ask the user whether they want to start another focus session.

Do not automatically start a new focus session unless the user has explicitly enabled that behavior.

## 9. User Interface and Visual Design

Follow the existing application's design system.

Create a premium, clean, distraction-free interface.

Suggested timer layout:

TOP SECTION
- Back button.
- "Focus Mode" heading.
- Settings button.

CENTER SECTION
- Current subject and topic.
- Large circular countdown timer.
- Animated progress ring.
- Current session type.

BOTTOM SECTION
- Start, Pause, or Resume button.
- End Session button.
- Completed Pomodoro count.
- Daily study goal indicator.

Use:
- Soft white backgrounds.
- Clear typography.
- Consistent spacing.
- Subtle shadows and borders.
- Accessible colors.
- Smooth but restrained animations.
- Responsive layouts.
- Proper loading, error, and empty states.

Avoid:
- Excessive gradients.
- Flashing effects.
- Overly bright colors.
- Distracting animations.
- Unnecessary decorative elements.
- Buttons that are too small.
- Overcrowded timer screens.

Use a circular timer that remains readable on small mobile screens and desktop layouts.

## 10. Settings and Customization

Add a Pomodoro Settings section containing:

- Focus duration.
- Short break duration.
- Long break duration.
- Long break interval.
- Auto-start breaks.
- Auto-start focus sessions.
- Completion notifications.
- Return-from-background notifications.
- Daily focus goal.
- Sound preferences.
- Vibration preferences, where supported.
- Reduced-motion preference, where supported.

Provide sensible defaults and validate all settings.

Store preferences using the application's existing persistence system.

Do not reset an active timer unexpectedly when the user changes settings.

Apply new timer settings to the next session unless the user explicitly chooses to restart the current session.

## 11. Reliability, Security, and Compatibility

Before implementing anything:
- Inspect the existing project.
- Identify the framework and installed versions.
- Review the current timer and study-session logic.
- Review navigation and persistence.
- Reuse existing components and dependencies where appropriate.

Do not introduce incompatible libraries.

Do not upgrade major dependencies without checking compatibility.

If the application uses Expo, ensure the implementation works with the installed Expo SDK and React Native version.

If the application is web-based, use browser-compatible APIs.

If persistence is already available, use it to preserve timer state and session history.

Handle:
- App backgrounding.
- App foregrounding.
- Device sleep.
- Unexpected application closure.
- Duplicate timer creation.
- Duplicate session records.
- Navigation edge cases.
- Notification permission denial.
- Missing subject or topic selections.
- Timer settings changes during active sessions.

Do not expose user data or credentials.

## 12. Testing Requirements

Test these scenarios before declaring the implementation complete:

1. Start a 25-minute focus session.
2. Pause and resume the timer.
3. Confirm paused time does not count as study time.
4. Attempt to navigate away while the timer is running.
5. Select Continue Studying.
6. Attempt to leave again and select Pause & Leave.
7. Return to the timer and resume the saved session.
8. Attempt to leave and select End Session & Leave.
9. Verify that the session is recorded exactly once.
10. Allow a focus session to finish naturally.
11. Confirm that the Pomodoro completion count increases correctly.
12. Start and finish a short break.
13. Confirm that break time is excluded from study statistics.
14. Send the app to the background and return.
15. Verify timer accuracy after the device sleeps or the app is suspended.
16. Test notification behavior.
17. Test Android Back navigation, if supported.
18. Test browser navigation and refresh warnings, if the app runs on the web.
19. Restart the application and verify session recovery.
20. Confirm that all existing study features still work.

Fix any bugs introduced by the changes.

Do not claim a scenario passed unless it was actually tested.

## 13. Implementation Workflow

Follow this sequence:

**Phase 1:** Audit the existing project.

**Phase 2:** Design the Pomodoro timer and session-state architecture.

**Phase 3:** Implement the timer, Focus Mode, and navigation warnings.

**Phase 4:** Implement background handling, persistence, and optional notifications.

**Phase 5:** Integrate the timer with existing statistics and progress tracking.

**Phase 6:** Improve the interface and fix any related UI/UX problems.

**Phase 7:** Run available tests, type checks, linting, and builds.

**Phase 8:** Provide a concise summary of implemented features, modified files, dependencies, tests performed, and known limitations.

# FINAL INSTRUCTION

Implement this feature directly in my existing study app.

The main objective is to create a reliable Pomodoro Timer that encourages students to focus, warns them before they navigate away from an active study session, preserves their progress, and integrates seamlessly with the existing statistics dashboard.

Do not merely generate a plan or mockup. Make the actual code changes wherever the available environment permits.

Do not rebuild the application from scratch, remove existing functionality, or fabricate study statistics.

The final result should feel like a polished, production-quality feature of the existing application.