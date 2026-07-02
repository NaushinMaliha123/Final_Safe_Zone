-- Create the database
CREATE DATABASE IF NOT EXISTS smart_safezone;

USE smart_safezone;

-- Create users table to store profile information
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uid VARCHAR(255) UNIQUE NOT NULL, -- This will be the Firebase UID
    name VARCHAR(255),
    email VARCHAR(255) UNIQUE NOT NULL,
    userType ENUM('Student', 'Guardian') NOT NULL,
    mobile VARCHAR(20),
    gender VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table for Student-Guardian linking requests
CREATE TABLE IF NOT EXISTS guardian_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_uid VARCHAR(255) NOT NULL,
    guardian_phone VARCHAR(20) NOT NULL,
    relationship VARCHAR(50),
    status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_uid) REFERENCES users(uid) ON DELETE CASCADE
);

-- Example table for SafeZones (optional, for future use)
CREATE TABLE IF NOT EXISTS safe_zones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_uid VARCHAR(255),
    zone_name VARCHAR(255),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    radius INT, -- in meters
    FOREIGN KEY (user_uid) REFERENCES users(uid) ON DELETE CASCADE
);
