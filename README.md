<!-- PROJECT LOGO -->
<p align="center">
  <h3 align="center">OneHash </h3>
</p>

<!-- ABOUT THE PROJECT -->

## About The Project

<img width="100%" alt="booking-screen" src="https://user-images.githubusercontent.com/8019099/176390354-f1bc7069-0341-437a-9bb8-eb41092b4016.gif">

<!-- GETTING STARTED -->

## Getting Started

To get a local copy up and running, please follow these simple steps.

### Prerequisites

Here is what you need to be able to run Cal.

- Node.js (Version: >=15.x <17)
- PostgreSQL
- Yarn _(recommended)_

## Development

### Setup

1. Clone the repository.

   ```sh
   git clone https://github.com/calcom/cal.com.git
   ```

1. Go to the project folder

   ```sh
   cd cal.com
   ```

1. Install packages with yarn

   ```sh
   sudo yarn
   ```
   Note: Incorrect node version may cause issues in running yarn.

1. Set up your .env file , contact the team lead for further details

### Starting Application Locally:
- #### Run command `sudo yarn dx` in first terminal: 

    > - **Requires Docker and Docker Compose to be installed**
    > - Will start a local Postgres instance with a few test users - the credentials will be logged in the console

    ```sh
    sudo yarn dx
    ```
- #### Run this SSL proxy in second terminal:
     - ```sh
        sudo npm i -g local-ssl-proxy
       ```
     - Write this command below, and a editor will open in terminal.
       
       - ```sh
         sudo nano /etc/hosts 
         ```
       - Add the following line in the editor:
         ```sh
          127.0.0.1        localhost.onecal.com
         ```
       - ```sh
          yarn run-ssl
         ```
 - #### Open the Localhost URL:
     - ```sh
        https://localhost.onecal.com:3001
       ```
