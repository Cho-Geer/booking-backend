# CRM Booking Platform Backend

Backend service for a CRM-style booking platform built with **NestJS**.

This project demonstrates how to build a scalable backend system with authentication, booking management, caching, and RESTful APIs.

---

# Overview

This project demonstrates how to build a scalable backend service using NestJS.

The system is designed as a CRM-style booking platform that supports authentication, booking management, real-time communication, and API documentation.

The architecture follows a modular and layered design to ensure maintainability and scalability.

Main responsibilities include:

- User authentication
- Booking management
- REST API services
- Real-time communication
- Data persistence
- API documentation

The system is designed with modular architecture to support future expansion.

---

# Features

- JWT based authentication
- Booking management system
- RESTful API architecture
- Real-time updates via WebSocket
- Redis caching
- API documentation with Swagger
- Docker based development environment

# Tech Stack

Backend Framework

- NestJS
- TypeScript

Database

- PostgreSQL
- Prisma ORM

Caching

- Redis

Authentication

- JWT (JSON Web Token)

API Documentation

- Swagger

Real-time Features

- WebSocket

Dev Tools

- Docker
- Jest
- ESLint

# System Architecture

```
Frontend (Next.js)
        │
        ▼
REST API (NestJS)
        │
        ▼
Service Layer
        │
        ▼
Repository Layer (Prisma)
        │
        ▼
PostgreSQL
```

Additional services:

- Redis (Caching)
- WebSocket Gateway (Real-time updates)
- External API integrations

# Project Structure

```
src
├── auth           # Authentication module
├── users          # User management
├── bookings       # Booking system core logic
├── notifications  # Notification services
├── websocket      # Real-time communication
├── common         # Shared utilities
└── config         # Application configuration
```

# Core Modules

## 🔐 Authentication

Handles user authentication and authorization.

Features:

- JWT authentication
- Login / Register
- Role-based access control

---

## 📅 Booking Module

Core module of the system.

Responsibilities:

- Create booking
- Update booking
- Cancel booking
- Query booking records

---

## 👤 User Module

Manages user information.

Includes:

- User profile
- User role management

---

# Database Design

Main tables:

Users  
Bookings  
Notifications  

Example booking structure:

```
id
user_id
booking_time
status
created_at
```

Prisma ORM is used to manage database schema and queries.

---

# API Documentation

API documentation is generated with **Swagger**.

Example endpoints:

```
POST   /auth/login
POST   /bookings
GET    /bookings
GET    /users/profile
```

---

# Architecture Diagram

```
             ┌──────────────┐
             │   Frontend   │
             │   (Next.js)  │
             └──────┬───────┘
                    │ REST API
                    ▼
             ┌──────────────┐
             │    NestJS    │
             │   Backend    │
             └──────┬───────┘
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
   PostgreSQL                Redis
   (Database)                (Cache)
```

# Running the Project

## Install dependencies

npm install


## Start development server


npm run start:dev


## Run tests


npm run test


---

# Docker Support

The project can be started using Docker.


docker-compose up


This will start:

- NestJS API
- PostgreSQL
- Redis

---

# Testing

Testing framework:

- Jest

Test coverage includes:

- Service logic
- Controllers
- Integration tests

---

# Future Improvements

Possible future improvements:

- API rate limiting
- Event-driven architecture
- Microservices support
- GraphQL API
- Monitoring and logging

---

# Author

Zixi Tao

Senior Software Engineer  
14+ years of experience in enterprise systems

GitHub  
https://github.com/Cho-Geer
