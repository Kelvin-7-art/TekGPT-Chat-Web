# 🤖 TeKGPT

<div align="center">

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

</div>

> **An AI-powered chat application with vision capabilities** - Upload images, ask questions, and get intelligent responses powered by LLaVA and local AI.


### 📱 Quick Demo GIF

![TeKGPT Demo](https://github.com/Kelvin-7-art/TekGPT-Chat-Web/blob/main/TekGPT.gif)

### 🖼️ Image Analysis Demo

![Image Analysis](https://github.com/Kelvin-7-art/TekGPT-Chat-Web/blob/main/image%20analysis.gif)

</div>

## ✨ Features

### 🤖 Core AI Features
- **💬 Intelligent Chat** - Real-time conversations with AI assistant
- **🖼️ Vision Capabilities** - Upload and analyze images using LLaVA
- **🧠 Context-Aware** - Remembers conversation history
- **⚡ Fast Responses** - Streaming AI responses for real-time feedback

### 🎨 User Experience
- **🔍 Search Chats** - Find previous conversations instantly
- **📂 Conversation History** - Organized by recency
- **🎨 Dark Theme** - Modern, eye-friendly design
- **📱 Responsive** - Works on desktop, tablet, and mobile

### 🔒 Privacy & Security
- **🏠 Local AI** - Everything runs locally with Ollama
- **🔐 No Data Sharing** - Your data never leaves your machine
- **💰 No API Costs** - Free to use, no subscription needed

## 📸 Screenshots & Media

<div align="center">

### Main Interface
![Main Interface](https://github.com/Kelvin-7-art/TekGPT-Chat-Web/blob/main/TekGPT%20home.png)

### Image Analysis
![Image Analysis](https://github.com/Kelvin-7-art/TekGPT-Chat-Web/blob/main/tekgpt%20image.png)

### Chat History
![Chat History](https://github.com/Kelvin-7-art/TekGPT-Chat-Web/blob/main/history.png)

### Mobile View
![Mobile View](https://github.com/Kelvin-7-art/TekGPT-Chat-Web/blob/main/mobile%20tekgpt.png)



</div>



## 🛠️ Technology Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| **React 18** | UI Framework with Hooks & Context |
| **TypeScript** | Type-safe development |
| **Vite** | Lightning-fast build tool |
| **Tailwind CSS** | Utility-first styling |
| **React Query** | State management & data fetching |

### Backend
| Technology | Purpose |
|------------|---------|
| **Node.js** | JavaScript runtime |
| **Express.js** | Web framework |
| **PostgreSQL** | Relational database |
| **Drizzle ORM** | Type-safe database operations |

### AI & Integrations
| Technology | Purpose |
|------------|---------|
| **Ollama** | Local AI model server |
| **LLaVA** | Vision-language model |
| **REST API** | Clean API architecture |

## 📋 Prerequisites

Before you begin, ensure you have installed:

- **Node.js** v18+ - [Download](https://nodejs.org/)
- **PostgreSQL** 14+ - [Download](https://www.postgresql.org/download/)
- **Ollama** - [Download](https://ollama.com/download)
- **Git** - [Download](https://git-scm.com/)

## 🚀 Installation

### 1. Clone the Repository

\\\ash
git clone https://github.com/Kelvin-7-art/TekGPT-Chat-Web.git
cd Chat-Web
\\\

### 2. Install Dependencies

\\\ash
npm install --legacy-peer-deps
\\\

### 3. Set Up PostgreSQL Database

\\\ash
# Create database user
psql -U postgres -d postgres -c "CREATE USER khots WITH PASSWORD 'your_password';"

# Create database
psql -U postgres -d postgres -c "CREATE DATABASE chatdb OWNER khots;"

# Grant privileges
psql -U postgres -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE chatdb TO khots;"
\\\

### 4. Configure Environment Variables

Create a .env file in the root directory:



### 5. Run Database Migrations

\\\ash
npx drizzle-kit push
\\\

### 6. Set Up Ollama (for Vision Features)

\\\ash
# Start Ollama service
ollama serve

# Pull LLaVA model
ollama pull llava
\\\

### 7. Start the Development Server

\\\ash
npm run dev
\\\

The application will be available at **http://localhost:5000**

## 🎯 Use Cases

### 💻 For Developers
- Write, debug, and explain code
- Get programming help and suggestions
- Analyze error messages and stack traces
- Generate boilerplate code

### 🎨 For Creatives
- Generate ideas and stories
- Get feedback on creative projects
- Brainstorm solutions
- Design assistance

### 📚 For Students
- Explain complex concepts
- Summarize study materials
- Get homework help
- Practice language skills

### 🏢 For Professionals
- Analyze reports and documents
- Get quick answers to questions
- Generate professional responses
- Image analysis for presentations

## 📁 Project Structure

\\\
TeKGPT/
├── 📁 client/                 # React frontend
│   ├── 📁 src/
│   │   ├── 📁 components/     # React components
│   │   │   ├── ChatInterface.tsx
│   │   │   └── Sidebar.tsx
│   │   ├── 📁 hooks/          # Custom hooks
│   │   │   └── use-chat.ts
│   │   ├── 📁 pages/          # Page components
│   │   │   ├── Chat.tsx
│   │   │   └── Home.tsx
│   │   └── 📁 lib/            # Utilities
│   └── index.html
│
├── 📁 server/                 # Node.js backend
│   ├── 📁 replit_integrations/
│   │   ├── 📁 chat/           # Chat API
│   │   └── 📁 vision/         # Vision API
│   ├── db.ts                  # Database config
│   ├── index.ts               # Server entry
│   └── routes.ts              # API routes
│
├── 📁 shared/                 # Shared code
│   └── 📁 models/             # Data models
│
├── 📁 migrations/             # Database migrations
├── 📁 media/                  # Videos & GIFs
├── 📁 screenshots/            # Screenshots
├── 📄 package.json            # Dependencies
├── 📄 .env                    # Environment variables
└── 📄 README.md               # Documentation
\\\

## 🔧 API Endpoints

### Chat Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/conversations | Get all conversations |
| POST | /api/conversations | Create new conversation |
| GET | /api/conversations/:id | Get conversation by ID |
| POST | /api/conversations/:id/messages | Send a message |

### Vision Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/vision/analyze | Analyze an image |
| GET | /api/vision/health | Check vision service health |
| POST | /api/vision/describe | Quick image description |

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. **Fork** the repository
2. **Create** a feature branch: git checkout -b feature/amazing-feature
3. **Commit** changes: git commit -m 'Add amazing feature'
4. **Push** to branch: git push origin feature/amazing-feature
5. **Open** a Pull Request

### Development Guidelines

- Follow the existing code style
- Write meaningful commit messages
- Update documentation as needed
- Test your changes thoroughly

## 🐛 Troubleshooting

### Common Issues

#### PostgreSQL Connection Errors
\\\ash
# Check if PostgreSQL is running
psql -U postgres -c "SELECT version();"

# Reset database permissions
psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS chatdb;"
psql -U postgres -d postgres -c "CREATE DATABASE chatdb OWNER khots;"
\\\

#### Ollama Not Responding
\\\ash
# Start Ollama service
ollama serve

# Check if model is installed
ollama list

# Pull model if missing
ollama pull llava
\\\

#### Port Already in Use
\\\ash
# Change port in .env
PORT=5001
\\\

## 📊 Performance

| Metric | Performance |
|--------|-------------|
| Chat Response | 1-5 seconds |
| Image Analysis | 5-30 seconds |
| Concurrent Users | Unlimited (scalable) |
| Database | < 100ms queries |
| Frontend Load | < 2 seconds |

## 🚀 Deployment

### Deploy on Vercel (Frontend)

\\\ash
npm run build
vercel --prod
\\\

### Deploy on Railway (Backend + Database)

\\\ash
# Connect your GitHub repository
# Railway automatically deploys on push
\\\

### Deploy with Docker

\\\dockerfile
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
\\\

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **[Replit](https://replit.com)** - Initial project structure
- **[Ollama](https://ollama.com)** - Local AI deployment
- **[LLaVA](https://llava-vl.github.io/)** - Vision-language model
- **[Vite](https://vitejs.dev/)** - Build tool
- **[React](https://reactjs.org/)** - UI framework

## 📞 Contact

**Your Name**
- GitHub: [@YOUR_USERNAME](https://github.com/YOUR_USERNAME)
- LinkedIn: [YOUR_LINKEDIN](https://linkedin.com/in/YOUR_LINKEDIN)
- Email: your.email@example.com

## ⭐ Show Your Support

If you found this project helpful, please give it a ⭐ on GitHub!

---

<div align="center">

Built with ❤️ by [Your Name]

</div>
