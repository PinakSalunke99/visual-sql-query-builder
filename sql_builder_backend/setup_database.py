# setup_database.py
import sqlite3

conn = sqlite3.connect('database.db')
cursor = conn.cursor()

# --- Drop existing tables to start fresh ---
cursor.execute("DROP TABLE IF EXISTS Students;")
cursor.execute("DROP TABLE IF EXISTS Courses;")
cursor.execute("DROP TABLE IF EXISTS Professors;")
cursor.execute("DROP TABLE IF EXISTS Departments;")
cursor.execute("DROP TABLE IF EXISTS Enrollments;")
cursor.execute("DROP TABLE IF EXISTS Classrooms;")
cursor.execute("DROP TABLE IF EXISTS Grades;")

# --- Create Tables ---
cursor.execute("""
CREATE TABLE Departments (
    dept_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    building TEXT
);
""")

cursor.execute("""
CREATE TABLE Students (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    age INTEGER,
    major TEXT,
    dept_id INTEGER,
    FOREIGN KEY (dept_id) REFERENCES Departments(dept_id)
);
""")

cursor.execute("""
CREATE TABLE Professors (
    prof_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    department TEXT,
    dept_id INTEGER,
    FOREIGN KEY (dept_id) REFERENCES Departments(dept_id)
);
""")

cursor.execute("""
CREATE TABLE Courses (
    course_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    credits INTEGER,
    dept_id INTEGER,
    prof_id INTEGER,
    FOREIGN KEY (dept_id) REFERENCES Departments(dept_id),
    FOREIGN KEY (prof_id) REFERENCES Professors(prof_id)
);
""")

cursor.execute("""
CREATE TABLE Classrooms (
    room_id TEXT PRIMARY KEY,
    building TEXT,
    capacity INTEGER
);
""")

cursor.execute("""
CREATE TABLE Enrollments (
    enrollment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    course_id TEXT,
    FOREIGN KEY (student_id) REFERENCES Students(id),
    FOREIGN KEY (course_id) REFERENCES Courses(course_id)
);
""")

cursor.execute("""
CREATE TABLE Grades (
    grade_id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    course_id TEXT,
    grade TEXT,
    FOREIGN KEY (student_id) REFERENCES Students(id),
    FOREIGN KEY (course_id) REFERENCES Courses(course_id)
);
""")

# --- Insert Departments ---
cursor.executemany("""
INSERT INTO Departments (dept_id, name, building) VALUES (?, ?, ?)
""", [
    (1, 'Computer Science', 'Tech Building'),
    (2, 'Mathematics', 'Science Hall'),
    (3, 'Physics', 'Research Complex')
])

# --- Insert Students ---
cursor.executemany("""
INSERT INTO Students (id, name, age, major, dept_id) VALUES (?, ?, ?, ?, ?)
""", [
    (1, 'Alice', 21, 'Computer Science', 1),
    (2, 'Bob', 22, 'Mathematics', 2),
    (3, 'Charlie', 20, 'Physics', 3),
    (4, 'Diana', 22, 'Computer Science', 1),
    (5, 'Ethan', 23, 'Mathematics', 2),
    (6, 'Fiona', 19, 'Computer Science', 1)
])

# --- Insert Professors ---
cursor.executemany("""
INSERT INTO Professors (prof_id, name, department, dept_id) VALUES (?, ?, ?, ?)
""", [
    (101, 'Dr. Elara Vance', 'Computer Science', 1),
    (102, 'Dr. Ben Carter', 'Mathematics', 2),
    (103, 'Dr. Nora Patel', 'Physics', 3)
])

# --- Insert Courses ---
cursor.executemany("""
INSERT INTO Courses (course_id, title, credits, dept_id, prof_id) VALUES (?, ?, ?, ?, ?)
""", [
    ('CS101', 'Intro to Programming', 3, 1, 101),
    ('CS201', 'Data Structures', 4, 1, 101),
    ('MATH203', 'Linear Algebra', 4, 2, 102),
    ('PHYS110', 'Classical Mechanics', 3, 3, 103),
    ('CS301', 'Operating Systems', 4, 1, 101)
])

# --- Insert Classrooms ---
cursor.executemany("""
INSERT INTO Classrooms (room_id, building, capacity) VALUES (?, ?, ?)
""", [
    ('T101', 'Tech Building', 40),
    ('S201', 'Science Hall', 35),
    ('R305', 'Research Complex', 30)
])

# --- Insert Enrollments ---
cursor.executemany("""
INSERT INTO Enrollments (student_id, course_id) VALUES (?, ?)
""", [
    (1, 'CS101'),
    (1, 'MATH203'),
    (2, 'MATH203'),
    (3, 'PHYS110'),
    (4, 'CS201'),
    (5, 'MATH203'),
    (6, 'CS101'),
    (6, 'CS301')
])

# --- Insert Grades ---
cursor.executemany("""
INSERT INTO Grades (student_id, course_id, grade) VALUES (?, ?, ?)
""", [
    (1, 'CS101', 'A'),
    (1, 'MATH203', 'B+'),
    (2, 'MATH203', 'A-'),
    (3, 'PHYS110', 'B'),
    (4, 'CS201', 'A'),
    (5, 'MATH203', 'C+'),
    (6, 'CS101', 'A'),
    (6, 'CS301', 'B+')
])

conn.commit()
conn.close()

print("✅ Database recreated with extended schema and populated with more sample data.")
