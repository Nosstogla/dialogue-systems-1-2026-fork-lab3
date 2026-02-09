# Lab 3 | Basic dialogue management
# Fixed (Only npm, no more yarn)

## Getting started with development environment

Note:

Node.js and npm should be installed on your system. Please check:
```bash
node -v
```
This should give an output, something like: v22.13.1
```bash
npm -v
```
This should give an output, something like: 11.8.0

### Preflight step 1. Create Azure account and enable speech services

1. Apply for free student credits: https://azure.microsoft.com/en-us/free/students/. You should be able to login with your GU account.

2. Make sure that you are logged into the Azure portal (https://portal.azure.com/).

3. Create a **Resource group** (you can use search field):
   - Subscription: *Azure for students*
   - Resource group: *RG-GU-1* (or any name)
   - Region: *(Europe) North Europe* (another region if you can't create North Europe)

4. Create a **Speech service** (you can use search field):
   - Name: *SpeechService1* (or any name)
   - Subscription: *Azure for students*
   - Location: *(Europe) North Europe* (same region from before)
   - Pricing tier: *Free (F0)*
   - Resource group: *RG-GU-1* (or the same group name from the previous step)

5. Within your Speech Service go to: *Resource management → Keys and Endpoint* and save your *KEY 1* value. You will need it later. This is a personal key that should be only visible to you.

### Preflight step 2. Run the example project

1. Fork the example project on GitHub (this project): https://github.com/GU-CLASP/dialogue-systems-1-2026

2. Before cloning, make sure you `Sync fork` and pull the updates if you forked this project before this update (Feb 9)

   Navigate to the directory where you want to work (your home directory by default):
   ```sh
   cd
   ```
   Clone your fork to your machine:
   ```sh
   git clone <your_forks'_https.git>
   ```
4. Go to the `<name_of_your_fork>/labs/lab3fixed/Code/` folder.
   ```sh
   cd <name_of_your_fork>/labs/lab3fixed/Code/
   ```
5. Install all dependencies:
   ```bash
   npm install
   ```
   ```bash
   npm install xstate
   npm install speechstate@latest
   npm install @statelyai/inspect
   ```
6. Create a file called `azure.ts` in `src/` folder:
   ```sh
   cd src/
   ```
   ```sh
   touch azure.ts
   ```
   Add the following content inside:
   ```typescript
   export const KEY = "paste your KEY 1 here";
   ```
   You can do it via terminal:
   ```sh
   echo 'export const KEY = "paste your KEY 1 here";' >> azure.ts
   ```
   Don't add this file to version control. ".gitignore" file does it for you. Check where that file is located using `cd` and `ls -la` commands (hint: `cd ..`) and see which files are not added to version control:
   ```sh
   cat .gitignore
   ```
   Add azure.ts file to ".gitignore" file while specifying its relative location to ".gitignore":
   ```sh
   echo "src/azure.ts" >> .gitignore
   ```
   (Note: Using `echo` command with a single ">" will overwrite the file! As a rule of thumb, be very careful when using this command! For example, `echo "src/azure.ts" > .gitignore` will overwrite everything inside ".gitignore" file!)

7. Replace `YOUR_REGION` sections inside `dm.ts` file with your Azure region (e.g., `northeurope`, `swedencentral`). Check two places:
      1. In the `endpoint` URL
      2. In the `azureRegion` setting

8. Run the development local server in `Code` directory:
   ```bash
   npm run dev
   ```
   `O + Enter` shortcut to open it in your default browser.

9. Allow access to your microphone.

10. When you unblock the pop-up window, and reload the page you will see the state inspector; this can be useful during development.

11. Error handling:

`The requested module does not provide an export named 'AnyActorRef'`

If you see this type of error because for some reason Vite carrying over cache from your previous attempts, try and clear Vite's cache:
```bash
rm -rf node_modules/.vite
npm run dev
```

Package installation issues:

If you encounter dependency conflicts:
```bash
rm -rf node_modules package-lock.json
npm install
```

## Assignment

- **Task 1 ("appointment")**: Implementation of the finite state machine.
- **Task 2 ("features")**: Add some extra features to your app.
- **Task 3 ("improvements")**: Describe the limitations of your app and try to fix them.

### Task 1. "Appointment"

![Flowchart for creating an appointment](flowchart.png)

**In this task you will need to implement the flowchart above.**

We have created a starting point for you, so you basically can use the project that you forked before:
- You will need to edit the state chart defined by `dmMachine` in `./src/dm.ts`:
- You will need to extend the entities in the grammar (`const grammar`) to understand more names, times and dates.
- You will also need to add more things in the `context`, see: `./src/types.ts` file.
- We defined some helper functions that you can use. Feel free to add your own functions.
- You will also need to create a similar grammar to understand "yes" and "no", but also "of course", "no way" etc.

### Task 2. Additional features

1. Re-raise the question if the user is not talking or if the entity is not in the grammar.
2. Try to repeat yourself as little as possible (hint: some of the event handling can be moved to parent states).

### Task 3. Improvements (bonus: 1 VG point)

- Write a report (max 1 page) which describes errors and limitation of your app.
- Fix a couple of them and briefly describe your solution in the report. You don't have to fix all the limitations.
- Add your report to the repository in PDF format (`report-lab3.pdf`)

## Resources

- [XState documentation](https://stately.ai/docs/)
- [SpeechState documentation](https://github.com/vladmaraev/speechstate)

Git docs:
- [Getting started with git](https://docs.github.com/en/get-started/quickstart/hello-world)
- [Working with forks](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/fork-a-repo)

## Submission

- **Commit** your changes and **push** them to your repository (your fork of this repository)
- On GitHub page of your repository, click **Contribute** -> **Open pull request**. Then click on **Create pull request**. Change the title to "Lab 3 submission" (if you want to ask a question about your code, use the title "Lab 3 work in progress"). Click on **Create pull request**.
- On Canvas, submit URL to the pull request that you just created.
