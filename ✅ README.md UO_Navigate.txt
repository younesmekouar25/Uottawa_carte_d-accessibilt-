✅ README.md – Version Finale pour UO_Navigate
# UO_Navigate – Interactive Accessibility Map for the University of Ottawa

UO_Navigate is a web-based accessibility mapping platform designed to help students, staff, and visitors—especially individuals with reduced mobility—navigate the University of Ottawa campus more easily.  
This project was developed as part of the **GNG2501 – Design and Innovation** course.

Overview

UO_Navigate provides a unified platform that combines indoor and outdoor navigation with accessibility data.  
The goal is to centralize all information related to accessible routes and facilities across campus.

### Key Features
- **Outdoor navigation** powered by OSRM for accessible pathways  
- **Indoor navigation** using custom-built graph-based routing  
- Display of:
  - Accessible Zone
  - Accessible washrooms  
  - entrances  
  - Rooms and corridors  
- **Incident reporting module** for identifying obstacles (e.g., broken elevators, blocked paths)  
- **Events panel** showing activities that may impact mobility or circulation  
- Fully interactive UI built with **Next.js + MapLibre GL**

---

📁 Project Structure



/frontend → Web application (Next.js + MapLibre)
/backend → FastAPI backend with routing logic and database access
/data → GeoJSON / Graph data for buildings and floors
/docs → Documentation and design files


---

## 🚀 How to Run the Project Locally

### 1. Clone the repository
```bash
git clone https://github.com/younesmekouar25/Uottawa_carte_d-accessibilt-.git

cd Uottawa_carte_d-accessibilt-

🖥️ Frontend Setup (Next.js)
Install dependencies
cd frontend
npm install

Start the development server
npm run dev


The application will be available at:
http://localhost:3000




🗂️ Data Files

Our indoor graph and campus building data are located in the /data folder, including:

Building polygons

Floor-by-floor indoor graphs

Entrances

Important accessibility points (elevators, accessible washrooms, etc.)

These datasets are custom-made using QGIS and exported in GeoJSON format.

🎥 Demo Video

A full demonstration of the current prototype is available here:
Demo Video Link
https://uottawa-my.sharepoint.com/personal/amaro091_uottawa_ca/Documents/Attachments/Video%20a%20explicative%20de%20l%27application.mp4?csf=1&web=1&e=XQByEO&nav=eyJyZWZlcnJhbEluZm8iOnsicmVmZXJyYWxBcHAiOiJTdHJlYW1XZWJBcHAiLCJyZWZlcnJhbFZpZXciOiJTaGFyZURpYWxvZy1MaW5rIiwicmVmZXJyYWxBcHBQbGF0Zm9ybSI6IldlYiIsInJlZmVycmFsTW9kZSI6InZpZXcifX0%3D

🎨 Design Day (fall 2025)

This project was presented at the University of Ottawa's Engineering Design Day.
Project profile:

https://makerepo.com/Cmarone9/2680.uonavigate

👥 Team Members

UO_Navigate was developed by:

Abdou Khadre Charles Marone

Younes Mekouar

Ousmane Kroman 

Ryad Maamri 

Brunel Ahlonsou 



Contact

For questions or collaboration opportunities:

Primary Contact:
Abdou Khadre Charles Marone
Email: amaro091@uottawa.ca

LinkedIn: https://www.linkedin.com/in/abdou-khadre-c-m/
