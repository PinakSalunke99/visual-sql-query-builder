\# Visual SQL Query Builder



\## Overview

Visual SQL Query Builder is a web application that allows users to construct SQL queries using a drag-and-drop interface without manually writing SQL syntax.



The system dynamically generates SQL queries and executes them on the backend, displaying results in a structured table format.



\## Technologies Used



Frontend:

\- React.js

\- DnD-Kit

\- Axios

\- HTML / CSS



Backend:

\- Python

\- Flask

\- SQLite



\## Features



\- Drag-and-drop SQL query construction

\- Automatic SQL query generation

\- Schema discovery from database

\- Real-time query execution

\- Result visualization in table format



\## Architecture



Frontend: React UI for building query blocks  

Backend: Flask API that converts JSON commands into SQL queries  

Database: SQLite database with sample academic schema



\## How to Run



\### Backend



```bash

cd sql\_builder\_backend

python app.py

