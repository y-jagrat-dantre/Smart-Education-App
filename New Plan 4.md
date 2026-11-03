# PROJECT: Add a Complete Digital Books & Notes Library to My Existing Study App

I have an existing study application with learning features and a worldwide student community. I now want to add a dedicated **Books & Notes Library** where students can access educational books in PDF format, find subject-wise notes, upload their own notes as PDFs, and share useful study resources with other students.

The library should feel like a modern digital learning platform with organized educational resources, a built-in PDF reader, search, downloads, bookmarks, and community contributions.

**IMPORTANT:** First inspect my existing project, including its framework, authentication, database, storage, navigation, design system, and community features. Implement this feature directly within the existing application.

Do not rebuild the application from scratch or break existing functionality.

# 1. Books & Notes Library

Add a new main navigation section named **Library**.

Inside the Library, create these categories:

1. Textbooks
2. Study Notes
3. Chapter-Wise Notes
4. Revision Notes
5. Previous-Year Question Papers
6. Sample Papers
7. Practice Worksheets
8. Student Contributions
9. My Saved Resources
10. My Uploads

Only implement categories appropriate to the application, and allow new categories to be added easily.

### Library Home Screen

Display:
- A prominent search bar.
- Browse by Class.
- Browse by Subject.
- Browse by Resource Type.
- Popular Resources.
- Recently Added.
- Recommended for Your Class.
- Recently Viewed.
- Saved Resources.
- Upload Notes button.

Use attractive resource cards with:
- PDF cover or thumbnail.
- Resource title.
- Class or academic level.
- Subject.
- Chapter or topic, if applicable.
- Language.
- File size.
- Page count, when available.
- Contributor or publisher information.
- Publication or upload date.
- Download button.
- Bookmark button.

Display only information that is actually available. Do not fabricate download counts, ratings, or page counts.

# 2. Class-Wise Textbook Library

Create a textbook browsing system organized by educational level.

### Class Selection

For an initial Indian education focus, support:
- Classes 1–12.
- Stream selection for applicable senior-secondary classes.
- Undergraduate and postgraduate resources where appropriate.
- Competitive examination materials where permitted.

Allow users to choose their class during onboarding or from the Library screen.

The app should remember the user's preferred class and use it to improve recommendations.

Users must still be able to browse other classes.

### Subject Selection

After choosing a class, display relevant subjects.

Examples:
- Mathematics.
- Physics.
- Chemistry.
- Biology.
- English.
- Hindi.
- Social Science.
- History.
- Geography.
- Political Science.
- Economics.
- Accountancy.
- Business Studies.
- Computer Science.
- Informatics Practices.

Subjects must be configurable because curricula differ between boards, schools, and academic years.

### Education Boards

Allow resources to be organized by board, such as:
- CBSE.
- CISCE/ICSE.
- State Boards.
- Other recognized curricula.

Do not assume that every subject or book applies to every board.

Use the board, class, subject, edition, and academic year as appropriate to identify resources accurately.

### Textbook Details

Each textbook entry should include:
- Book title.
- Class.
- Subject.
- Board or curriculum.
- Publisher or issuing organization.
- Edition or academic year, when known.
- Language.
- PDF file size.
- Page count, when available.
- Official source or attribution.
- Open PDF button.
- Download button, when permitted.
- Bookmark button.

**Important:** Do not populate the library with invented books or fake download links. Only display actual resources.

# 3. Official Educational PDF Sources

Design the library so that educational books can be imported from verified, legally accessible sources.

For Indian school textbooks, support appropriate official sources such as:

- NCERT textbooks and educational publications.
- Official CBSE academic resources.
- State education board publications.
- Official educational institutions that publish resources for public access.

Use official source links wherever possible.

The app should support two ways of providing books:

**Method A: Official External Resources**
- Link to the original official PDF or publication page.
- Open the resource in the app when technically and legally possible.
- Otherwise, open the official source in a browser.
- Display the original source and attribution.

**Method B: Hosted PDFs**
- Store PDF files in the application's storage when you have permission to host them.
- Maintain metadata and a reference to the source.
- Provide a built-in reader and optional download functionality.

Do not automatically copy every external PDF into private storage. Check source terms and hosting permissions first.

Do not assume that a publicly accessible PDF is automatically free to redistribute.

Do not bypass website restrictions, paywalls, or access controls.

# 4. Built-In PDF Reader

Create an integrated PDF reader so students can read textbooks and notes without leaving the app whenever supported.

### Reader Features
- Open PDFs within the application.
- Display the document title.
- Page navigation.
- Previous and next page controls.
- Page number indicator.
- Zoom in and zoom out.
- Fit-to-width option.
- Full-screen reading mode.
- Search within the document, if supported.
- Text selection and copying, where the PDF permits it.
- Share resource link.
- Download PDF, when permitted.
- Bookmark the resource.
- Resume reading from the last viewed page.

### Reading Experience
- Keep controls easy to access.
- Provide a clean reading interface.
- Support portrait and landscape orientations where appropriate.
- Preserve the reading position when the user leaves and returns.
- Display loading indicators while opening documents.
- Show a helpful error if a PDF cannot be opened.
- Provide an external-browser option when an embedded reader cannot display the file.

Do not load an entire large PDF into memory unnecessarily.

Use an appropriate PDF viewer compatible with the application's existing framework.

# 5. Upload Your Own Notes as PDF

This is one of the most important features.

Allow authenticated users to upload their own educational notes in PDF format and share them with the community.

Add a prominent **Upload Notes** button.

### Upload Form

Include these fields:

**PDF File**
- Select a PDF from the device.
- Display the selected filename.
- Display the file size.
- Allow the user to replace or remove the selected file.
- Validate the file before uploading.

**Title**
- Required.
- Example: "Class 10 Mathematics — Quadratic Equations Notes".

**Description**
- Optional explanation of the contents.

**Class or Academic Level**
- Classes 1–12.
- Undergraduate.
- Postgraduate.
- Competitive examinations.
- Other appropriate levels.

**Subject**
- Select from the existing subject categories.

**Chapter or Topic**
- Optional.

**Board or Curriculum**
- Optional where applicable.

**Language**
- English.
- Hindi.
- Other supported languages.

**Resource Type**
- Chapter notes.
- Revision notes.
- Handwritten notes.
- Formula sheets.
- Solved examples.
- Practice worksheets.
- Other.

**Visibility**
- Private.
- Shared with the community, subject to the application's permissions and moderation rules.

Only provide visibility choices that the backend can enforce correctly.

### Upload Process

When a student submits a PDF:

1. Validate the form.
2. Verify the file type and size.
3. Upload the PDF to the existing storage system.
4. Display upload progress.
5. Create a database record containing the resource metadata.
6. Associate the upload with the authenticated user.
7. Show a success message.
8. Make the resource available to its intended audience after any required moderation.

Prevent duplicate submissions caused by repeated button presses.

If an upload fails, provide a retry option without forcing the student to fill out the entire form again.

If a file uploads successfully but saving its metadata fails, handle the incomplete upload safely and provide a recovery or cleanup mechanism.

# 6. PDF Validation and Upload Security

Protect the app against malicious files and unauthorized uploads.

Requirements:
- Accept PDF files only for this feature.
- Validate the file's actual format instead of relying exclusively on the filename extension.
- Set a configurable maximum file size.
- Enforce upload permissions on the backend.
- Use authenticated uploads.
- Prevent unauthorized users from replacing or deleting other users' files.
- Apply appropriate storage access rules.
- Avoid exposing administrative credentials.
- Handle corrupted PDFs gracefully.
- Use safe filenames or generated storage identifiers.
- Prevent path traversal and arbitrary storage-path manipulation.
- Consider malware scanning where suitable infrastructure is available.
- Rate-limit repeated uploads to reduce spam.

Do not trust client-side validation alone.

Make the upload-size limit configurable according to the existing storage provider's constraints.

# 7. Community Notes and Resource Discovery

Connect the Notes Library to the existing worldwide student community.

Create a section called **Community Notes** where students can discover resources uploaded by other users.

Allow students to:
- Browse shared notes.
- Filter by class.
- Filter by subject.
- Filter by chapter.
- Filter by language.
- Filter by resource type.
- Search by title and description.
- Open PDFs.
- Download resources where permitted.
- Bookmark useful notes.
- Share resource links.
- Report inappropriate or infringing material.

Display contributor information using the user's public profile, without exposing private account information.

### Resource Details Page

Each resource should have a dedicated details screen showing:
- Title.
- Description.
- Class.
- Subject.
- Chapter.
- Language.
- Resource type.
- Contributor.
- Upload date.
- File size.
- Page count, if known.
- PDF preview.
- Open and download actions.
- Bookmark button.
- Report button.

If the existing community supports comments and voting, optionally allow feedback on educational resources.

Do not introduce fake ratings or reviews.

# 8. Search and Filtering

Create a fast search experience across books and notes.

Allow users to search by:
- Book or resource title.
- Subject.
- Chapter.
- Topic.
- Class.
- Board.
- Language.
- Contributor name.
- Resource description.

Add filters for:
- Class.
- Subject.
- Board.
- Language.
- Resource type.
- Official resources.
- Community uploads.
- Recently added.

Provide sorting options:
- Most recent.
- Alphabetical.
- Most bookmarked, if reliable bookmark data is available.

Use efficient queries and pagination.

Do not download every PDF just to search its metadata.

# 9. OCR and Searchable Notes — Optional Enhancement

If feasible within the existing architecture, add optional text extraction for supported PDFs.

This could allow students to search for topics inside PDFs.

For example, a student searching for "Newton's laws" could find a relevant resource even if that phrase appears in its contents rather than its title.

Requirements:
- Use an appropriate PDF text-extraction method.
- If a PDF contains scanned pages, support OCR only if a suitable OCR solution is available.
- Clearly distinguish searchable text from the original PDF.
- Preserve the original document.
- Handle documents with no extractable text.
- Avoid processing large files synchronously in the user interface.
- Respect resource permissions and privacy settings.

Do not introduce expensive external APIs without checking their cost first.

Treat OCR as an enhancement, not a requirement for the initial release.

# 10. Bookmarks, Reading History, and Offline Access

Implement a personal learning library.

### Bookmarks
Allow users to save:
- Textbooks.
- Notes.
- Revision materials.
- Question papers.
- Other supported resources.

### Reading History
Track:
- Recently opened resources.
- Last viewed page, where supported.
- Last access time.

Provide a "Continue Reading" section.

### Offline Access
Where permitted and technically feasible, allow users to download PDFs for offline reading.

Requirements:
- Display download progress.
- Show downloaded resources.
- Allow users to open downloaded PDFs without an internet connection.
- Provide a delete-download option.
- Keep offline files separate from the original cloud resource.
- Do not promise offline access to resources that are only available through external websites.
- Respect storage permissions and device limitations.

Do not automatically download large files without user consent.

# 11. Personal Recommendations

Use the user's selected class, preferred subjects, bookmarks, and learning activity to recommend relevant books and notes.

Examples:
- Recommended textbooks for the selected class.
- Notes for recently studied topics.
- Revision notes for bookmarked chapters.
- Recently added resources in preferred subjects.

If the study app already tracks the student's current subject or chapter, use that context where appropriate.

Recommendations should be based on available data.

Do not fabricate user activity or recommend resources that do not exist.

Allow users to dismiss irrelevant recommendations.

# 12. Admin Resource Management

If the existing application has an admin dashboard, integrate resource management into it.

Authorized administrators should be able to:
- Add official textbook links.
- Upload authorized PDFs.
- Edit resource metadata.
- Categorize resources.
- Set the applicable class, subject, board, and language.
- Publish or unpublish resources.
- Review community uploads.
- Approve or reject reported resources.
- Remove broken links.
- Identify duplicate entries.
- Manage resource categories.

Use role-based access controls enforced by the backend.

Do not trust a client-side admin flag alone.

Maintain appropriate audit records for important administrative actions.

Avoid building an entirely separate administration system if the existing admin dashboard can be extended.

# 13. Copyright and Educational Resource Policies

Implement the library responsibly.

### Official Books
- Prefer official, authorized PDF sources.
- Preserve attribution and source links.
- Verify redistribution permissions before hosting third-party books.

### Student Notes
- Allow students to upload original notes they created or materials they have permission to share.
- Require the uploader to confirm that they have the necessary rights to share the material.
- Provide a report mechanism for copyright concerns.
- Provide a reasonable review and removal process.
- Do not assume that every uploaded textbook or commercial study guide is authorized for redistribution.

### Content Management
- Distinguish official publications from community-created notes.
- Display source information clearly.
- Allow administrators to remove unauthorized content.
- Do not falsely label community notes as official textbooks.

# 14. Database and Storage Integration

First inspect the existing backend and storage architecture.

Reuse the current infrastructure whenever possible.

If the application uses Firebase, integrate with its existing authentication, database, and authorized storage setup.

If it uses Supabase, use its existing authentication, database, storage, and access-control mechanisms.

If another backend is already in place, follow that architecture instead.

### Suggested Resource Record

Design a suitable resource model containing:
- Resource ID.
- Title.
- Description.
- Resource type.
- Class or academic level.
- Subject.
- Chapter or topic.
- Board or curriculum.
- Language.
- File storage reference or official source URL.
- File size, when available.
- Page count, when available.
- Contributor ID, where applicable.
- Publication status.
- Visibility.
- Creation timestamp.
- Update timestamp.
- Copyright or permission metadata, where appropriate.

### Suggested Supporting Data
- User bookmarks.
- Reading history.
- Last viewed page.
- Offline download metadata, where appropriate.
- Reports.
- Moderation status.

Store actual PDFs in a suitable file-storage system rather than inserting large binary files directly into ordinary database records.

Use database records for metadata and storage references.

Enforce access control on both metadata and file downloads.

# 15. UI/UX Design

Follow the existing study app's design system.

Use a clean, modern, soft-white interface with:
- Consistent typography.
- Comfortable spacing.
- Attractive PDF thumbnails.
- Clear subject icons.
- Rounded cards.
- Subtle borders and shadows.
- Responsive layouts.
- Accessible text contrast.
- Smooth, restrained animations.
- Clear upload progress indicators.
- Useful empty states and error messages.

### Suggested Library Layout

At the top:
- "Books & Notes" heading.
- Search bar.
- Class selector.

Below:
- Quick category buttons.
- Recommended resources.
- Textbooks by class.
- Chapter-wise notes.
- Community Notes.
- Recently opened PDFs.
- Saved resources.

Add a prominent Upload Notes button.

On mobile, prioritize simple navigation, readable PDF previews, and easy file selection.

Do not overload the screen with too many categories at once.

# 16. Integration with Existing Features

Connect the library to the existing learning experience.

Where appropriate:
- Link notes to the relevant subjects.
- Link notes to chapters or topics.
- Let users open notes from a subject screen.
- Suggest revision notes for topics marked "Needs Revision".
- Allow resources to be shared in community discussions.
- Allow users to attach a permitted resource link to a community question.
- Let students return to their previous reading position.
- Include resource bookmarks in the user's saved learning materials.

Do not count PDF reading time as active study time automatically unless the application already has a clearly defined, user-controlled reading-session tracking feature.

Do not modify the Pomodoro timer or study statistics unnecessarily.

# 17. Performance and Reliability

Ensure the feature performs well on mobile devices and slower internet connections.

Implement:
- Pagination for resource listings.
- Lazy loading of thumbnails.
- Efficient PDF loading.
- Upload progress.
- Retry handling.
- Caching where appropriate.
- Graceful handling of broken external links.
- Safe handling of large PDFs.
- Clear loading and error states.
- Cleanup of abandoned uploads where feasible.

Avoid repeatedly downloading the same PDF when a suitable cached copy is available.

Do not block the entire application while a PDF loads or uploads.

# 18. Testing Requirements

Verify the following:

1. Users can browse books by class.
2. Users can filter books by subject.
3. Official PDF links open correctly.
4. Hosted PDFs open in the reader.
5. Users can upload valid PDF notes.
6. Invalid file types are rejected.
7. Oversized files receive a helpful error.
8. Upload progress is displayed correctly.
9. Failed uploads can be retried.
10. Uploaded notes appear in the appropriate library.
11. Private resources remain private.
12. Community resources are accessible according to their permissions.
13. Users can bookmark resources.
14. Reading history persists.
15. Search and filters work correctly.
16. Pagination loads additional resources.
17. Unauthorized users cannot edit or delete other users' uploads.
18. Administrators can manage resources according to their permissions.
19. Broken PDF links produce useful error messages.
20. Existing community, statistics, Pomodoro, and study features continue to work.

Run the available tests, linting, type checks, and builds.

Do not claim a test passed unless it was actually executed.

# 19. Implementation Workflow

Follow this order:

**Phase 1 — Audit**
Inspect the project, database, storage, authentication, navigation, and existing design.

**Phase 2 — Library Foundation**
Implement the library home screen, resource categories, search, and class-wise browsing.

**Phase 3 — PDF Reader**
Implement document viewing, page navigation, zoom, bookmarks, and reading history where supported.

**Phase 4 — Student Uploads**
Implement PDF selection, validation, upload progress, metadata, storage, and publication.

**Phase 5 — Community Integration**
Implement community notes, filters, resource details, bookmarks, and reporting.

**Phase 6 — Admin Tools**
Integrate resource management and moderation into the existing admin dashboard where available.

**Phase 7 — Polish and Optimize**
Improve the UI, loading performance, error handling, and responsive behavior.

**Phase 8 — Test**
Verify permissions, file uploads, PDF reading, persistence, and existing application functionality.

**Phase 9 — Report**
Summarize implemented features, changed files, dependencies, storage configuration, tests executed, and any remaining setup requirements.

# FINAL INSTRUCTIONS

Implement this feature directly in my existing study app.

Do not rebuild the application from scratch.

Do not create a separate demo.

Do not populate the production library with fake books, dummy PDFs, or invented download links.

Start with real, verified resources from official educational sources and a functioning PDF upload system.

Make sure students can browse books by class and subject, read PDFs inside the app where supported, upload their own notes, and share authorized materials with the student community.

Preserve all existing functionality and prioritize security, performance, usability, and accurate educational information.

The final result should feel like a complete digital library built into a modern student learning platform.  