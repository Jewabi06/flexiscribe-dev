const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { Pool } = require('pg');

/**
 * Seed comprehensive reviewers into the Lesson table.
 *
 * Each reviewer stores its content as a JSON string so the quiz-generation
 * pipeline can parse structured data (key concepts, definitions, facts, etc.)
 * instead of relying on free-form text.
 *
 * Usage:
 *   node prisma/seed-reviewer.js
 */

// ─── Reviewer Data ──────────────────────────────────────────────────────────

const reviewers = [
  // ════════════════════════════════════════════════════════════════════════════
  // 1. Introduction to Computer Science
  // ════════════════════════════════════════════════════════════════════════════
  {
    title: "Introduction to Computer Science",
    subject: "Computer Science",
    content: JSON.stringify({
      topic: "Introduction to Computer Science",
      summary: "Computer Science is the study of computation, algorithms, data structures, and the design of computer systems. It encompasses both theoretical foundations and practical applications that drive modern technology.",
      keyConcepts: [
        { term: "Algorithm", definition: "A finite, step-by-step procedure for solving a problem or performing a computation. Algorithms must be unambiguous, have defined inputs and outputs, and terminate after a finite number of steps." },
        { term: "Data Structure", definition: "A specialized format for organizing, storing, and accessing data efficiently. Common data structures include arrays, linked lists, stacks, queues, trees, and hash tables." },
        { term: "Binary System", definition: "A base-2 numeral system using only two digits, 0 and 1, which forms the fundamental language of computers. All data in a computer is ultimately represented in binary." },
        { term: "Abstraction", definition: "The process of hiding complex implementation details and exposing only the essential features. Abstraction allows programmers to manage complexity by working at higher levels of conceptualization." },
        { term: "Computational Thinking", definition: "A problem-solving methodology that involves decomposition, pattern recognition, abstraction, and algorithm design to solve complex problems systematically." },
        { term: "Turing Machine", definition: "A theoretical mathematical model of computation defined by Alan Turing that manipulates symbols on a strip of tape according to a table of rules. It serves as the foundation for the theory of computation." },
        { term: "Boolean Logic", definition: "A branch of algebra where values are either true or false. Boolean operations such as AND, OR, and NOT form the basis of digital circuit design and programming conditions." },
        { term: "Compiler", definition: "A program that translates source code written in a high-level programming language into machine code that the computer's processor can execute directly." },
        { term: "Operating System", definition: "System software that manages computer hardware and software resources and provides common services for computer programs. Examples include Windows, macOS, and Linux." },
        { term: "Recursion", definition: "A programming technique where a function calls itself to solve a smaller instance of the same problem. Every recursive function must have a base case to prevent infinite recursion." }
      ],
      importantFacts: [
        "The first programmable computer, the ENIAC, was completed in 1945 and weighed approximately 30 tons.",
        "Ada Lovelace is widely recognized as the first computer programmer for her work on Charles Babbage's Analytical Engine in the 1840s.",
        "Moore's Law states that the number of transistors on a microchip doubles approximately every two years, leading to exponential growth in computing power.",
        "The internet was originally developed as ARPANET in 1969 by the United States Department of Defense.",
        "Big O notation is used to describe the upper bound of an algorithm's time or space complexity, with O(1) being constant time and O(n²) being quadratic time.",
        "A byte consists of 8 bits and can represent 256 different values (0 to 255).",
        "The Von Neumann architecture, proposed in 1945, describes a computer with a processing unit, control unit, memory, and input/output mechanisms — a design still used in most modern computers.",
        "ASCII (American Standard Code for Information Interchange) uses 7 bits to represent 128 characters including letters, digits, and control characters.",
        "The World Wide Web was invented by Tim Berners-Lee in 1989 at CERN.",
        "Python, created by Guido van Rossum in 1991, is one of the most popular programming languages due to its readability and versatility."
      ],
      detailedContent: "Computer Science is a broad discipline that spans theoretical foundations and practical applications. At its core, it studies how information can be represented, processed, and communicated. The field begins with understanding how computers represent data using the binary system — sequences of 0s and 1s that encode everything from numbers to images. Algorithms are the heart of computer science; they provide systematic methods for solving problems efficiently. The efficiency of an algorithm is measured using Big O notation, which classifies algorithms by their worst-case performance. Common time complexities include O(1) for constant time, O(log n) for logarithmic time, O(n) for linear time, O(n log n) for linearithmic time, and O(n²) for quadratic time. Data structures work hand-in-hand with algorithms. An array provides O(1) access by index but O(n) insertion. A hash table offers average O(1) lookup using a hash function. A binary search tree provides O(log n) search, insert, and delete operations when balanced. A stack follows Last-In-First-Out (LIFO) order, while a queue follows First-In-First-Out (FIFO) order. Programming paradigms define how developers structure code. Imperative programming uses statements to change program state. Object-Oriented Programming (OOP) organizes code into objects that encapsulate data and behavior, using principles like inheritance, polymorphism, encapsulation, and abstraction. Functional programming treats computation as the evaluation of mathematical functions and avoids changing state. The software development life cycle (SDLC) includes phases: requirements gathering, design, implementation, testing, deployment, and maintenance. Agile methodologies emphasize iterative development and collaboration. Computer networks enable communication between devices. The OSI model defines seven layers: Physical, Data Link, Network, Transport, Session, Presentation, and Application. The TCP/IP protocol suite is the foundation of the internet, using IP addresses to route packets between devices."
    })
  },

  // ════════════════════════════════════════════════════════════════════════════
  // 2. Data Structures and Algorithms
  // ════════════════════════════════════════════════════════════════════════════
  {
    title: "Data Structures and Algorithms",
    subject: "Computer Science",
    content: JSON.stringify({
      topic: "Data Structures and Algorithms",
      summary: "Data structures and algorithms form the backbone of efficient software engineering. Understanding how to organize data and solve problems algorithmically is essential for writing performant programs.",
      keyConcepts: [
        { term: "Array", definition: "A contiguous block of memory storing elements of the same type, allowing O(1) random access by index. Arrays have a fixed size in most languages, though dynamic arrays (like ArrayList or Python lists) can resize automatically." },
        { term: "Linked List", definition: "A linear data structure where each element (node) contains data and a reference (pointer) to the next node. Singly linked lists point forward only, while doubly linked lists point both forward and backward." },
        { term: "Stack", definition: "A Last-In-First-Out (LIFO) data structure that supports push (add to top) and pop (remove from top) operations, both in O(1) time. Used in function call management, undo mechanisms, and expression evaluation." },
        { term: "Queue", definition: "A First-In-First-Out (FIFO) data structure that supports enqueue (add to rear) and dequeue (remove from front) operations. Used in breadth-first search, task scheduling, and buffer management." },
        { term: "Binary Search Tree (BST)", definition: "A tree data structure where each node has at most two children, and for every node, all values in the left subtree are less than the node's value and all values in the right subtree are greater. Provides O(log n) average-case search, insert, and delete." },
        { term: "Hash Table", definition: "A data structure that maps keys to values using a hash function to compute an index into an array of buckets. Provides average O(1) time complexity for lookups, insertions, and deletions. Collisions are handled using chaining or open addressing." },
        { term: "Graph", definition: "A non-linear data structure consisting of vertices (nodes) connected by edges. Graphs can be directed or undirected, weighted or unweighted. Represented using adjacency matrices or adjacency lists." },
        { term: "Heap", definition: "A specialized tree-based data structure that satisfies the heap property. In a max-heap, every parent node is greater than or equal to its children. In a min-heap, every parent is less than or equal to its children. Used to implement priority queues." },
        { term: "Sorting Algorithm", definition: "An algorithm that puts elements in a certain order. Common sorting algorithms include Bubble Sort O(n²), Selection Sort O(n²), Insertion Sort O(n²), Merge Sort O(n log n), Quick Sort average O(n log n), and Heap Sort O(n log n)." },
        { term: "Dynamic Programming", definition: "An algorithmic technique that solves complex problems by breaking them into overlapping subproblems, solving each subproblem once, and storing results in a table (memoization or tabulation) to avoid redundant computation." },
        { term: "Breadth-First Search (BFS)", definition: "A graph traversal algorithm that explores all vertices at the present depth before moving to vertices at the next depth level. Uses a queue and finds the shortest path in unweighted graphs. Time complexity is O(V + E)." },
        { term: "Depth-First Search (DFS)", definition: "A graph traversal algorithm that explores as far as possible along each branch before backtracking. Uses a stack (or recursion). Time complexity is O(V + E). Used in topological sorting, cycle detection, and pathfinding." }
      ],
      importantFacts: [
        "Merge Sort is a stable, divide-and-conquer sorting algorithm with guaranteed O(n log n) time complexity in all cases (best, average, and worst).",
        "Quick Sort has an average time complexity of O(n log n) but a worst-case of O(n²) when the pivot selection is poor (e.g., already sorted data with first-element pivot).",
        "A balanced BST such as an AVL tree or Red-Black tree guarantees O(log n) operations by maintaining balance through rotations after insertions and deletions.",
        "Dijkstra's algorithm finds the shortest path from a single source to all other vertices in a weighted graph with non-negative edge weights. Its time complexity is O((V + E) log V) using a min-heap.",
        "The time complexity of searching in an unsorted array is O(n), but in a sorted array, binary search achieves O(log n).",
        "A hash table's worst-case time complexity degrades to O(n) when all keys hash to the same bucket (collision), but with a good hash function, average-case is O(1).",
        "Recursion uses the call stack to store function states. Deep recursion can cause a stack overflow error if the recursion depth exceeds the stack size limit.",
        "The Fibonacci sequence can be computed in O(n) time using dynamic programming (bottom-up tabulation) compared to O(2^n) with naive recursion.",
        "Topological sorting is only possible on Directed Acyclic Graphs (DAGs) and produces a linear ordering of vertices such that for every directed edge (u, v), u comes before v.",
        "The space complexity of BFS is O(V) because it stores all vertices at the current level in the queue, while DFS uses O(V) space for the recursion stack in the worst case."
      ],
      detailedContent: "Data structures provide the means to organize and store data so that operations like search, insert, delete, and update can be performed efficiently. The choice of data structure directly impacts the performance of an algorithm. Arrays store elements in contiguous memory locations, enabling O(1) access by index. However, inserting or deleting elements in the middle requires shifting, which takes O(n) time. Linked lists allow O(1) insertions and deletions at known positions but require O(n) to access an element by index. Stacks and queues are abstract data types built on arrays or linked lists. Stacks support LIFO access — the most recently added element is the first removed. They are used in expression parsing (infix to postfix conversion), backtracking algorithms, and managing function calls in the call stack. Queues support FIFO access and are used in BFS, print queues, and CPU scheduling. Trees hierarchically organize data. A binary tree has at most two children per node. A Binary Search Tree maintains the BST property for efficient searching. Self-balancing trees like AVL trees perform rotations to maintain O(log n) height. Red-Black trees use color properties to ensure balance. B-trees are used in databases and file systems for efficient disk access. Graphs model pairwise relationships. BFS explores level by level and is optimal for unweighted shortest paths. DFS explores depth-first and is used for topological sorting, finding connected components, and detecting cycles. Dijkstra's algorithm solves single-source shortest path for non-negative weights. Bellman-Ford handles negative weights. Floyd-Warshall finds all-pairs shortest paths. Sorting is fundamental. Comparison-based sorting has a lower bound of O(n log n). Non-comparison sorts like Counting Sort, Radix Sort, and Bucket Sort can achieve O(n) under specific conditions. Merge Sort is stable and guarantees O(n log n). Quick Sort is generally faster in practice due to better cache performance. Dynamic programming (DP) solves optimization problems by identifying optimal substructure and overlapping subproblems. Classic DP problems include the knapsack problem, longest common subsequence, matrix chain multiplication, and edit distance."
    })
  },

  // ════════════════════════════════════════════════════════════════════════════
  // 3. Object-Oriented Programming
  // ════════════════════════════════════════════════════════════════════════════
  {
    title: "Object-Oriented Programming (OOP)",
    subject: "Computer Science",
    content: JSON.stringify({
      topic: "Object-Oriented Programming",
      summary: "Object-Oriented Programming is a paradigm that organizes software design around objects — instances of classes that bundle data (attributes) and behavior (methods). The four pillars of OOP are encapsulation, abstraction, inheritance, and polymorphism.",
      keyConcepts: [
        { term: "Class", definition: "A blueprint or template that defines the attributes (properties) and methods (functions) that objects of that type will have. A class encapsulates data and behavior into a single unit." },
        { term: "Object", definition: "An instance of a class that contains actual values for the attributes defined by its class. Objects interact with each other through methods and represent real-world entities in code." },
        { term: "Encapsulation", definition: "The principle of bundling data and the methods that operate on that data within a single unit (class), and restricting direct access to some components using access modifiers like private, protected, and public." },
        { term: "Inheritance", definition: "A mechanism where a child class (subclass) derives properties and methods from a parent class (superclass), promoting code reuse. The child class can override or extend the parent's behavior." },
        { term: "Polymorphism", definition: "The ability of objects of different classes to be treated as objects of a common superclass. It allows the same method name to behave differently depending on the object. Achieved through method overriding (runtime) and method overloading (compile-time)." },
        { term: "Abstraction", definition: "The concept of hiding complex implementation details and exposing only the necessary interface to the user. Achieved through abstract classes and interfaces, allowing developers to work with higher-level concepts." },
        { term: "Constructor", definition: "A special method that is automatically called when an object is instantiated. It initializes the object's attributes with default or provided values. In Java, the constructor has the same name as the class." },
        { term: "Interface", definition: "A contract that specifies a set of method signatures that a class must implement. Interfaces enable multiple inheritance of type and support loose coupling between components." },
        { term: "Abstract Class", definition: "A class that cannot be instantiated directly and may contain abstract methods (without implementation) that must be overridden by concrete subclasses. It provides a partial implementation that subclasses complete." },
        { term: "Design Pattern", definition: "A reusable solution to a commonly occurring problem in software design. Examples include Singleton (ensures a class has only one instance), Factory (creates objects without specifying exact class), and Observer (one-to-many dependency notification)." }
      ],
      importantFacts: [
        "The four pillars of Object-Oriented Programming are Encapsulation, Abstraction, Inheritance, and Polymorphism — often abbreviated as the four OOP pillars.",
        "Method overriding occurs when a subclass provides a specific implementation for a method already defined in its superclass. This is runtime polymorphism.",
        "Method overloading occurs when multiple methods in the same class share the same name but differ in parameter types or number. This is compile-time polymorphism.",
        "The SOLID principles are five design principles for writing maintainable OOP code: Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, and Dependency Inversion.",
        "The Singleton design pattern restricts the instantiation of a class to a single instance and provides a global access point to that instance.",
        "In Java, all classes implicitly inherit from the Object class, which provides methods like toString(), equals(), and hashCode().",
        "Access modifiers control visibility: public (accessible everywhere), protected (accessible in the same package and subclasses), default/package-private (same package only), and private (same class only).",
        "Composition over inheritance is a design principle that favors building classes from components (has-a relationship) rather than deep inheritance hierarchies (is-a relationship).",
        "The Diamond Problem occurs in multiple inheritance when a class inherits from two classes that both inherit from a common base class. Java avoids this by disallowing multiple class inheritance but permitting multiple interface implementation.",
        "The Factory Method pattern defines an interface for creating objects but lets subclasses decide which class to instantiate, promoting loose coupling."
      ],
      detailedContent: "Object-Oriented Programming (OOP) is a programming paradigm based on the concept of objects, which contain data in the form of fields (attributes or properties) and code in the form of procedures (methods). A class serves as the blueprint from which individual objects are created. Classes define the structure and behavior, while objects are the actual instances with specific values. Encapsulation is achieved by declaring class fields as private and providing public getter and setter methods to access and modify them. This hides the internal state and requires all interaction to occur through well-defined interfaces. For example, a BankAccount class might have a private balance field with public deposit() and withdraw() methods that validate inputs before modifying the balance. Inheritance creates a parent-child relationship between classes. The subclass inherits all non-private fields and methods from the superclass and can add new ones or override existing ones. For example, a Dog class might extend an Animal class, inheriting the eat() method and adding a bark() method. The 'super' keyword is used to call the parent class's constructor or methods. Polymorphism allows code to work with objects of different types through a common interface. If both Dog and Cat extend Animal and override the makeSound() method, calling makeSound() on an Animal reference will invoke the correct subclass implementation at runtime. This is dynamic dispatch. Abstraction is implemented using abstract classes and interfaces. An abstract class Shape might declare an abstract method calculateArea() that each concrete subclass (Circle, Rectangle, Triangle) must implement. Interfaces define contracts — a Serializable interface might require implementing serialize() and deserialize() methods. The SOLID principles guide good OOP design. Single Responsibility Principle states a class should have only one reason to change. Open/Closed Principle states classes should be open for extension but closed for modification. Liskov Substitution Principle states objects of a superclass should be replaceable with objects of subclasses without altering correctness. Interface Segregation Principle states clients should not be forced to depend on interfaces they do not use. Dependency Inversion Principle states high-level modules should not depend on low-level modules; both should depend on abstractions."
    })
  },

  // ════════════════════════════════════════════════════════════════════════════
  // 4. Database Management Systems
  // ════════════════════════════════════════════════════════════════════════════
  {
    title: "Database Management Systems",
    subject: "Information Technology",
    content: JSON.stringify({
      topic: "Database Management Systems",
      summary: "A Database Management System (DBMS) is software that manages the creation, maintenance, and use of databases. It provides an interface between users and the database, ensuring data integrity, security, and efficient access.",
      keyConcepts: [
        { term: "Relational Database", definition: "A type of database that stores data in tables (relations) with rows (tuples) and columns (attributes). Tables are related through primary keys and foreign keys. SQL is used to query relational databases." },
        { term: "SQL (Structured Query Language)", definition: "A standardized programming language used to manage and manipulate relational databases. SQL commands include SELECT for queries, INSERT for adding data, UPDATE for modification, DELETE for removal, and CREATE TABLE for schema definition." },
        { term: "Primary Key", definition: "A column or set of columns in a table that uniquely identifies each row. Primary keys must be unique and cannot contain NULL values. Each table can have only one primary key." },
        { term: "Foreign Key", definition: "A column or set of columns in one table that refers to the primary key of another table, establishing a relationship between the two tables. Foreign keys enforce referential integrity." },
        { term: "Normalization", definition: "The process of organizing database tables to reduce data redundancy and improve data integrity. Normal forms include First Normal Form (1NF — atomic values), Second Normal Form (2NF — no partial dependencies), and Third Normal Form (3NF — no transitive dependencies)." },
        { term: "ACID Properties", definition: "A set of properties that guarantee database transactions are processed reliably: Atomicity (all or nothing), Consistency (valid state to valid state), Isolation (concurrent transactions don't interfere), and Durability (committed changes persist even after failure)." },
        { term: "Index", definition: "A database object that improves the speed of data retrieval operations on a table at the cost of additional storage and slower writes. Indexes are typically implemented using B-trees or hash tables." },
        { term: "JOIN Operation", definition: "An SQL operation that combines rows from two or more tables based on a related column. Types include INNER JOIN (matching rows only), LEFT JOIN (all left rows plus matching right), RIGHT JOIN (all right rows plus matching left), and FULL OUTER JOIN (all rows from both tables)." },
        { term: "Transaction", definition: "A sequence of one or more SQL operations treated as a single logical unit of work. A transaction either completes entirely (commit) or is completely undone (rollback) to maintain database consistency." },
        { term: "NoSQL Database", definition: "A non-relational database that provides flexible schemas and horizontal scaling. Types include document stores (MongoDB), key-value stores (Redis), column-family stores (Cassandra), and graph databases (Neo4j)." }
      ],
      importantFacts: [
        "The ACID properties — Atomicity, Consistency, Isolation, and Durability — ensure reliable processing of database transactions even in the event of system failures.",
        "First Normal Form (1NF) requires that all column values are atomic (no repeating groups or arrays). Second Normal Form (2NF) requires 1NF plus no partial dependency on a composite primary key. Third Normal Form (3NF) requires 2NF plus no transitive dependencies.",
        "An INNER JOIN returns only the rows that have matching values in both tables being joined.",
        "A LEFT JOIN returns all rows from the left table and the matched rows from the right table. Unmatched rows from the right table result in NULL values.",
        "B-tree indexes are the most common index type in relational databases and maintain sorted data for efficient searching, insertion, and deletion in O(log n) time.",
        "A deadlock occurs when two or more transactions are waiting for each other to release locks, creating a cycle of dependencies. The DBMS typically resolves deadlocks by aborting one of the transactions.",
        "The CAP theorem states that a distributed database system can guarantee at most two of three properties simultaneously: Consistency, Availability, and Partition Tolerance.",
        "SQL aggregate functions include COUNT (number of rows), SUM (total of values), AVG (average of values), MIN (smallest value), and MAX (largest value).",
        "A view is a virtual table defined by a SQL query that does not store data itself but provides a dynamic result set when queried.",
        "Stored procedures are precompiled SQL statements stored in the database that can accept parameters and be executed repeatedly, improving performance and security."
      ],
      detailedContent: "A Database Management System (DBMS) serves as the intermediary between users and the physical database. Relational Database Management Systems (RDBMS) like MySQL, PostgreSQL, Oracle, and SQL Server organize data into tables with defined schemas. Each table has columns (attributes) with specific data types and rows (records) containing actual data. The Entity-Relationship (ER) model is used during database design to define entities, their attributes, and relationships. Entities become tables, attributes become columns, and relationships are implemented through foreign keys. SQL (Structured Query Language) is divided into several sublanguages: DDL (Data Definition Language) includes CREATE, ALTER, and DROP for schema management; DML (Data Manipulation Language) includes SELECT, INSERT, UPDATE, and DELETE for data operations; DCL (Data Control Language) includes GRANT and REVOKE for permissions; TCL (Transaction Control Language) includes COMMIT, ROLLBACK, and SAVEPOINT. The SELECT statement is the most commonly used SQL command. It supports filtering with WHERE, sorting with ORDER BY, grouping with GROUP BY, and filtering grouped results with HAVING. Subqueries (nested queries) allow embedding one SELECT statement within another. Normalization eliminates redundancy: 1NF ensures atomic column values with no repeating groups. 2NF removes partial dependencies — every non-key attribute must depend on the entire primary key. 3NF removes transitive dependencies — non-key attributes must not depend on other non-key attributes. Boyce-Codd Normal Form (BCNF) is a stricter version of 3NF. Denormalization is sometimes applied for read-heavy workloads to improve query performance at the cost of some redundancy. Transactions follow the ACID properties. Concurrency control mechanisms like locking (shared locks for reads, exclusive locks for writes) and Multi-Version Concurrency Control (MVCC) manage simultaneous transactions. Isolation levels include Read Uncommitted, Read Committed, Repeatable Read, and Serializable, each offering different trade-offs between consistency and performance."
    })
  },

  // ════════════════════════════════════════════════════════════════════════════
  // 5. Web Development Fundamentals
  // ════════════════════════════════════════════════════════════════════════════
  {
    title: "Web Development Fundamentals",
    subject: "Information Technology",
    content: JSON.stringify({
      topic: "Web Development Fundamentals",
      summary: "Web development encompasses the creation and maintenance of websites and web applications. It involves front-end development (user interface), back-end development (server logic and databases), and full-stack development (both).",
      keyConcepts: [
        { term: "HTML (HyperText Markup Language)", definition: "The standard markup language for creating web pages. HTML uses elements represented by tags (like <div>, <p>, <h1>, <a>) to structure content. HTML5 introduced semantic elements like <header>, <nav>, <section>, <article>, and <footer>." },
        { term: "CSS (Cascading Style Sheets)", definition: "A stylesheet language that describes the visual presentation of HTML elements. CSS controls layout, colors, fonts, spacing, and responsive design. The cascade determines style priority based on specificity and source order." },
        { term: "JavaScript", definition: "A high-level, interpreted programming language that enables dynamic and interactive content on web pages. JavaScript runs in the browser (client-side) and on servers (Node.js). It supports event-driven, functional, and object-oriented programming." },
        { term: "HTTP (HyperText Transfer Protocol)", definition: "The application-layer protocol for transmitting hypermedia documents. HTTP defines methods like GET (retrieve data), POST (submit data), PUT (update data), DELETE (remove data), and PATCH (partial update). HTTPS adds encryption via TLS/SSL." },
        { term: "REST API", definition: "Representational State Transfer — an architectural style for designing networked applications using HTTP methods. RESTful APIs are stateless, use standard HTTP verbs, and represent resources with URLs. Responses are typically in JSON format." },
        { term: "DOM (Document Object Model)", definition: "A programming interface that represents an HTML or XML document as a tree structure of nodes. JavaScript uses the DOM API to dynamically access and modify content, structure, and styles of web pages." },
        { term: "Responsive Design", definition: "A web design approach that makes web pages render well on different screen sizes and devices. Achieved through CSS media queries, flexible grid layouts, and relative units like percentages, em, rem, and viewport units (vw, vh)." },
        { term: "Single Page Application (SPA)", definition: "A web application that loads a single HTML page and dynamically updates content using JavaScript without full page reloads. Frameworks like React, Vue.js, and Angular are commonly used to build SPAs." },
        { term: "Authentication vs Authorization", definition: "Authentication verifies the identity of a user (who are you?), while authorization determines what actions an authenticated user is allowed to perform (what can you do?). Common methods include JWT (JSON Web Tokens), OAuth 2.0, and session cookies." },
        { term: "Version Control (Git)", definition: "A system that records changes to files over time so that specific versions can be recalled later. Git is a distributed version control system. Key commands include git clone, git add, git commit, git push, git pull, git branch, and git merge." }
      ],
      importantFacts: [
        "HTTP status codes are grouped into categories: 1xx (Informational), 2xx (Success — e.g., 200 OK, 201 Created), 3xx (Redirection — e.g., 301 Moved Permanently, 304 Not Modified), 4xx (Client Error — e.g., 400 Bad Request, 401 Unauthorized, 404 Not Found), and 5xx (Server Error — e.g., 500 Internal Server Error).",
        "The CSS Box Model consists of four parts from inside out: content, padding, border, and margin. The box-sizing property determines whether padding and border are included in the element's width and height.",
        "The three pillars of web accessibility are perceivable (content is available to senses), operable (interface components are navigable), and understandable (information and UI operation are clear).",
        "CORS (Cross-Origin Resource Sharing) is a security mechanism that allows or restricts web applications running at one origin to make requests to a different origin.",
        "Local Storage stores data with no expiration date (persists after browser close), while Session Storage stores data only for the duration of the browser session.",
        "React uses a Virtual DOM to minimize direct manipulation of the actual DOM, comparing the new Virtual DOM with the previous one (diffing) and applying only the necessary changes (reconciliation).",
        "Node.js is a JavaScript runtime built on Chrome's V8 engine that allows JavaScript to run on the server side, enabling full-stack JavaScript development.",
        "CSS Flexbox is a one-dimensional layout model for arranging items in rows or columns, while CSS Grid is a two-dimensional layout model for creating complex page layouts with rows and columns simultaneously.",
        "JSON (JavaScript Object Notation) is a lightweight data-interchange format that is easy for humans to read and write and easy for machines to parse and generate.",
        "Webpack is a module bundler that takes JavaScript modules with dependencies and generates static assets representing those modules."
      ],
      detailedContent: "Web development is divided into front-end, back-end, and full-stack development. Front-end development focuses on the user interface and user experience using HTML, CSS, and JavaScript. HTML provides the semantic structure of web content. Modern HTML5 includes semantic elements like <header>, <nav>, <main>, <section>, <article>, <aside>, and <footer> that improve accessibility and SEO. CSS controls the visual presentation. The cascade resolves conflicting styles through specificity (inline > ID > class > element) and source order. CSS preprocessors like Sass and Less add features like variables, nesting, and mixins. CSS Flexbox provides a one-dimensional layout system using properties like display: flex, justify-content, align-items, and flex-wrap. CSS Grid offers a two-dimensional layout system with grid-template-rows, grid-template-columns, and grid areas. JavaScript adds interactivity and dynamic behavior. ES6+ introduced let/const (block-scoped variables), arrow functions, template literals, destructuring, spread/rest operators, promises, async/await, and modules (import/export). The DOM API allows JavaScript to traverse and manipulate the document tree using methods like getElementById, querySelector, createElement, and addEventListener. Back-end development handles server-side logic, databases, and APIs. Popular back-end technologies include Node.js with Express, Python with Django or Flask, and Java with Spring Boot. RESTful APIs follow six constraints: client-server architecture, statelessness, cacheability, uniform interface, layered system, and optional code on demand. Each REST endpoint represents a resource accessed via HTTP methods. Authentication typically uses JWTs — a compact, URL-safe token containing a header (algorithm), a payload (claims like user ID and expiration), and a signature. The token is sent in the Authorization header as 'Bearer <token>'. Front-end frameworks like React use a component-based architecture where the UI is built from reusable, composable components. React's Virtual DOM performs efficient updates by comparing the previous and current state trees."
    })
  },

  // ════════════════════════════════════════════════════════════════════════════
  // 6. Operating Systems
  // ════════════════════════════════════════════════════════════════════════════
  {
    title: "Operating Systems Concepts",
    subject: "Computer Science",
    content: JSON.stringify({
      topic: "Operating Systems",
      summary: "An Operating System (OS) is system software that manages hardware resources and provides services for application programs. It handles process management, memory management, file systems, I/O management, and security.",
      keyConcepts: [
        { term: "Process", definition: "An instance of a program in execution. Each process has its own memory space, program counter, registers, and stack. Processes transition between states: New, Ready, Running, Waiting, and Terminated." },
        { term: "Thread", definition: "A lightweight unit of execution within a process. Threads within the same process share memory and resources but have their own stack and registers. Multithreading allows concurrent execution within a process." },
        { term: "CPU Scheduling", definition: "The method by which the OS determines which process runs on the CPU at any given time. Scheduling algorithms include First-Come-First-Served (FCFS), Shortest Job First (SJF), Round Robin (RR), and Priority Scheduling." },
        { term: "Deadlock", definition: "A situation where two or more processes are unable to proceed because each is waiting for a resource held by another. Four necessary conditions: Mutual Exclusion, Hold and Wait, No Preemption, and Circular Wait." },
        { term: "Virtual Memory", definition: "A memory management technique that gives an application the impression of having a large, contiguous block of memory, even if physical RAM is limited. It uses paging to swap data between RAM and disk storage." },
        { term: "Paging", definition: "A memory management scheme that divides physical memory into fixed-size blocks called frames and logical memory into blocks of the same size called pages. The page table maps virtual addresses to physical addresses." },
        { term: "File System", definition: "The method an OS uses to organize, store, and retrieve files on storage devices. Common file systems include NTFS (Windows), ext4 (Linux), and APFS (macOS). Files are organized in a hierarchical directory structure." },
        { term: "Semaphore", definition: "A synchronization primitive used to control access to shared resources by multiple processes. A counting semaphore allows a specified number of concurrent accesses, while a binary semaphore (mutex) allows only one." },
        { term: "Context Switch", definition: "The process of saving the state (context) of the currently running process and loading the state of the next process to be executed. Context switching has overhead and its frequency affects system performance." },
        { term: "System Call", definition: "An interface between a running process and the operating system kernel. System calls request OS services such as file operations (open, read, write, close), process control (fork, exec, wait), and communication (pipe, socket)." }
      ],
      importantFacts: [
        "The four necessary conditions for deadlock are Mutual Exclusion (resources cannot be shared), Hold and Wait (processes hold resources while waiting for others), No Preemption (resources cannot be forcibly taken), and Circular Wait (a circular chain of processes each waiting for a resource held by the next).",
        "Round Robin scheduling assigns a fixed time quantum to each process in the ready queue. When a process's quantum expires, it is moved to the back of the queue. Smaller quantum values increase context switching overhead but improve response time.",
        "A page fault occurs when a process tries to access a page that is not currently in physical memory. The OS must retrieve the page from disk, which is significantly slower than RAM access.",
        "Thrashing occurs when the system spends more time swapping pages between RAM and disk than executing processes, usually caused by insufficient physical memory for the working set of active processes.",
        "The fork() system call creates a new process (child) that is a copy of the calling process (parent). The child process gets a return value of 0, while the parent gets the child's PID.",
        "A mutex (mutual exclusion) ensures that only one thread can access a critical section at a time. The thread must acquire the lock before entering and release it upon leaving.",
        "Shortest Job First (SJF) scheduling minimizes average waiting time but requires knowledge of the next CPU burst length, which is often estimated using exponential averaging.",
        "The kernel is the core component of an operating system that has complete control over everything in the system. It operates in kernel mode (privileged), while user applications run in user mode (restricted).",
        "Interrupt handling allows the OS to respond to asynchronous events. Hardware interrupts signal events like I/O completion, while software interrupts (traps) are triggered by programs for system calls or errors.",
        "The producer-consumer problem is a classic synchronization problem where producers add items to a shared buffer and consumers remove them. It is solved using semaphores or monitors to prevent race conditions."
      ],
      detailedContent: "An Operating System (OS) serves as the intermediary between hardware and software applications. The kernel is the core of the OS, managing all system resources. Modern operating systems use a layered architecture with hardware at the bottom, the kernel above it, system utilities above the kernel, and user applications at the top. Process management is a fundamental OS function. A process is a program in execution with its own address space, program counter, and execution context. Processes are created using system calls like fork() in Unix/Linux. The OS maintains a Process Control Block (PCB) for each process, storing information including process ID, state, program counter, CPU registers, memory management information, and I/O status. CPU scheduling determines which process gets CPU time. First-Come-First-Served (FCFS) is simple but can cause the convoy effect where short processes wait behind long ones. Shortest Job First (SJF) minimizes average waiting time but may cause starvation of long processes. Round Robin (RR) gives each process a time quantum and cycles through the ready queue, providing fair CPU access. Priority Scheduling assigns priorities to processes; lower-priority processes may starve without aging mechanisms. Memory management allocates and deallocates memory for processes. Virtual memory uses paging or segmentation to provide each process with its own logical address space. The page table translates virtual addresses to physical addresses. The Translation Lookaside Buffer (TLB) is a hardware cache of recent page table entries that speeds up address translation. Page replacement algorithms like Least Recently Used (LRU), FIFO, and Optimal determine which page to evict when physical memory is full. Synchronization mechanisms prevent race conditions when multiple threads access shared data. Critical sections are code regions where shared resources are accessed. Semaphores use wait() and signal() operations to control access. Monitors provide a higher-level synchronization construct with mutual exclusion built in."
    })
  },

  // ════════════════════════════════════════════════════════════════════════════
  // 7. Networking Fundamentals
  // ════════════════════════════════════════════════════════════════════════════
  {
    title: "Computer Networking Fundamentals",
    subject: "Information Technology",
    content: JSON.stringify({
      topic: "Computer Networking",
      summary: "Computer networking involves the interconnection of computing devices to share resources and communicate. Networks are built on layered protocols that define how data is formatted, transmitted, and received.",
      keyConcepts: [
        { term: "OSI Model", definition: "The Open Systems Interconnection model is a conceptual framework with seven layers: Physical (bits over medium), Data Link (frames, MAC addressing), Network (packets, IP addressing, routing), Transport (segments, TCP/UDP), Session (session management), Presentation (data format, encryption), and Application (end-user protocols like HTTP, FTP, SMTP)." },
        { term: "TCP/IP Model", definition: "A four-layer networking model that is the foundation of the internet: Network Access (physical + data link), Internet (IP routing), Transport (TCP/UDP), and Application (HTTP, DNS, SMTP). More practical than OSI for real-world networking." },
        { term: "IP Address", definition: "A numerical label assigned to each device on a network. IPv4 uses 32-bit addresses (e.g., 192.168.1.1) allowing about 4.3 billion unique addresses. IPv6 uses 128-bit addresses (e.g., 2001:0db8::1) allowing approximately 3.4 × 10^38 addresses." },
        { term: "TCP (Transmission Control Protocol)", definition: "A connection-oriented transport protocol that provides reliable, ordered delivery of data. TCP uses a three-way handshake (SYN, SYN-ACK, ACK) to establish connections and implements flow control and error recovery." },
        { term: "UDP (User Datagram Protocol)", definition: "A connectionless transport protocol that provides fast but unreliable delivery without guaranteeing order or delivery confirmation. Used for real-time applications like video streaming, online gaming, and DNS queries." },
        { term: "DNS (Domain Name System)", definition: "A hierarchical system that translates human-readable domain names (like www.example.com) into IP addresses. DNS uses a distributed database with root servers, TLD servers, and authoritative name servers." },
        { term: "Subnet Mask", definition: "A 32-bit number that divides an IP address into network and host portions. For example, a subnet mask of 255.255.255.0 (/24) means the first 24 bits identify the network and the last 8 bits identify hosts, allowing 254 usable host addresses." },
        { term: "Router", definition: "A networking device that forwards data packets between different networks. Routers use routing tables and protocols (like OSPF, BGP, RIP) to determine the best path for forwarding packets to their destination." },
        { term: "Firewall", definition: "A network security device that monitors and filters incoming and outgoing network traffic based on predefined security rules. Firewalls can be hardware-based, software-based, or cloud-based, and they control access between trusted and untrusted networks." },
        { term: "NAT (Network Address Translation)", definition: "A technique that maps multiple private IP addresses to a single public IP address. NAT allows multiple devices on a local network to access the internet using one public IP, conserving IPv4 address space." }
      ],
      importantFacts: [
        "The TCP three-way handshake establishes a connection in three steps: (1) Client sends SYN, (2) Server responds with SYN-ACK, (3) Client sends ACK. The connection is then established for data transfer.",
        "The seven layers of the OSI model from bottom to top are: Physical, Data Link, Network, Transport, Session, Presentation, and Application.",
        "A MAC (Media Access Control) address is a unique 48-bit hardware identifier assigned to a network interface card. It operates at the Data Link layer (Layer 2) and is written as six pairs of hexadecimal digits (e.g., AA:BB:CC:DD:EE:FF).",
        "DHCP (Dynamic Host Configuration Protocol) automatically assigns IP addresses and other network configuration parameters to devices, eliminating the need for manual configuration.",
        "The default gateway is the IP address of the router that a device uses to communicate with devices on other networks. Without a default gateway, a device can only communicate within its own subnet.",
        "ARP (Address Resolution Protocol) translates Layer 3 IP addresses to Layer 2 MAC addresses within a local network. When a device knows the destination IP but not the MAC address, it broadcasts an ARP request.",
        "HTTPS uses TLS (Transport Layer Security) to encrypt HTTP communications, preventing eavesdropping and man-in-the-middle attacks. TLS uses asymmetric encryption for key exchange and symmetric encryption for data transfer.",
        "A VLAN (Virtual Local Area Network) logically segments a physical network into separate broadcast domains, improving security and reducing broadcast traffic without requiring separate physical infrastructure.",
        "Bandwidth measures the maximum data transfer rate of a network connection (measured in bits per second), while latency measures the time delay for data to travel from source to destination (measured in milliseconds).",
        "The ping command uses ICMP (Internet Control Message Protocol) to test connectivity and measure round-trip time between two network devices."
      ],
      detailedContent: "Computer networking enables devices to share resources and communicate. The OSI model provides a theoretical framework with seven layers, each responsible for specific functions. At Layer 1 (Physical), data is transmitted as raw bits over physical media such as copper cables, fiber optics, or wireless radio waves. Layer 2 (Data Link) frames data and uses MAC addresses for local delivery. Switches operate at this layer, forwarding frames based on MAC address tables. Layer 3 (Network) handles logical addressing using IP addresses and routing between different networks. Routers operate at this layer, using routing protocols like OSPF (Open Shortest Path First) and BGP (Border Gateway Protocol) to determine optimal paths. Layer 4 (Transport) provides end-to-end communication using TCP or UDP. TCP ensures reliable, ordered delivery through sequence numbers, acknowledgments, and retransmission of lost segments. TCP implements flow control using a sliding window mechanism that adjusts the rate of data transmission. UDP is faster but unreliable — it sends datagrams without establishing a connection or confirming delivery. IP addressing divides networks into classes. Private IP ranges include 10.0.0.0/8, 172.16.0.0/12, and 192.168.0.0/16. CIDR (Classless Inter-Domain Routing) notation like /24 specifies the number of network bits. Subnetting divides a network into smaller subnetworks, improving organization and security. DNS resolution follows a hierarchical process: the client queries a recursive resolver, which checks its cache, then queries root DNS servers, TLD (top-level domain) servers, and finally the authoritative name server for the domain. Network security includes firewalls that filter traffic using Access Control Lists (ACLs), Intrusion Detection Systems (IDS) that monitor for suspicious activity, and VPNs (Virtual Private Networks) that create encrypted tunnels over public networks."
    })
  },

  // ════════════════════════════════════════════════════════════════════════════
  // 8. Software Engineering
  // ════════════════════════════════════════════════════════════════════════════
  {
    title: "Software Engineering Principles",
    subject: "Computer Science",
    content: JSON.stringify({
      topic: "Software Engineering",
      summary: "Software Engineering applies systematic, disciplined, and quantifiable approaches to the development, operation, and maintenance of software. It encompasses methodologies, design patterns, testing strategies, and project management practices.",
      keyConcepts: [
        { term: "Software Development Life Cycle (SDLC)", definition: "A structured process for planning, creating, testing, and deploying software. Common phases include requirements analysis, system design, implementation (coding), testing, deployment, and maintenance." },
        { term: "Agile Methodology", definition: "An iterative approach to software development that emphasizes flexibility, collaboration, and customer feedback. Agile frameworks include Scrum (sprints, daily standups, retrospectives) and Kanban (visual board, work-in-progress limits)." },
        { term: "Waterfall Model", definition: "A sequential software development approach where each phase (requirements, design, implementation, testing, deployment, maintenance) must be completed before the next begins. Changes are difficult to implement once a phase is complete." },
        { term: "Unit Testing", definition: "Testing individual components (units) of code in isolation to verify they work correctly. Unit tests are automated, fast, and should cover edge cases. Frameworks include JUnit (Java), pytest (Python), and Jest (JavaScript)." },
        { term: "Integration Testing", definition: "Testing the interaction between integrated modules or components to verify they work together correctly. It detects interface defects between modules that individual unit tests cannot catch." },
        { term: "Version Control", definition: "A system that manages changes to source code over time. Git is the most widely used distributed version control system. Branching strategies include Git Flow, GitHub Flow, and trunk-based development." },
        { term: "CI/CD (Continuous Integration / Continuous Deployment)", definition: "A DevOps practice where code changes are automatically built, tested, and deployed. CI merges code frequently into a shared repository with automated testing. CD automates the release process to production." },
        { term: "Code Review", definition: "A systematic examination of source code by peers to identify bugs, improve quality, and ensure adherence to coding standards. Code reviews are typically conducted through pull requests in version control systems." },
        { term: "Technical Debt", definition: "The implied cost of future rework caused by choosing a quick and easy solution now instead of a better approach that would take longer. Accumulated technical debt increases maintenance costs and reduces development speed." },
        { term: "Microservices Architecture", definition: "An architectural style where an application is composed of small, independent, loosely coupled services that communicate via APIs. Each service is deployed independently and can use different technologies." }
      ],
      importantFacts: [
        "Scrum is an Agile framework that organizes work into fixed-length iterations called sprints (typically 2-4 weeks). Key Scrum ceremonies include Sprint Planning, Daily Standup, Sprint Review, and Sprint Retrospective.",
        "The testing pyramid suggests having many unit tests at the base, fewer integration tests in the middle, and even fewer end-to-end tests at the top, optimizing the balance between test coverage and execution speed.",
        "Git branching allows parallel development. A feature branch isolates new work, a develop branch integrates features before release, and the main/master branch contains production-ready code.",
        "The DRY principle (Don't Repeat Yourself) states that every piece of knowledge should have a single, unambiguous representation in a system, reducing duplication and maintenance burden.",
        "The KISS principle (Keep It Simple, Stupid) advocates for simplicity in design, arguing that most systems work best when kept simple rather than made complex.",
        "Code smells are indicators of potential problems in code that may not be bugs but suggest the need for refactoring. Examples include long methods, large classes, duplicated code, and excessive comments.",
        "A pull request (or merge request) is a mechanism for a developer to notify team members that a feature branch is ready for review and merging into the main branch.",
        "Regression testing verifies that new code changes or bug fixes do not break existing functionality. Automated regression test suites are essential for continuous integration.",
        "Docker containers package an application and its dependencies into a standardized unit for software development, solving the 'it works on my machine' problem by ensuring consistent environments.",
        "Refactoring is the process of improving the internal structure of code without changing its external behavior, making it easier to understand, maintain, and extend."
      ],
      detailedContent: "Software engineering applies engineering principles to software development to produce reliable, efficient, and maintainable systems. The Software Development Life Cycle (SDLC) provides a framework for the software development process. The Waterfall model follows a linear, sequential approach where each phase flows into the next. While simple to manage, it is inflexible when requirements change. The Agile methodology emerged as an alternative, emphasizing iterative development, customer collaboration, and responsiveness to change. The Agile Manifesto values individuals and interactions over processes and tools, working software over comprehensive documentation, customer collaboration over contract negotiation, and responding to change over following a plan. Scrum implements Agile through sprints, which are time-boxed iterations of 2-4 weeks. The Product Owner maintains a prioritized Product Backlog. During Sprint Planning, the team selects backlog items for the sprint. Daily Standups (15-minute meetings) keep the team synchronized. The Sprint Review demonstrates completed work, and the Sprint Retrospective identifies process improvements. Version control with Git enables collaborative development. Developers create feature branches from the main branch, implement changes, and submit pull requests for code review. Merge conflicts occur when two branches modify the same code and must be resolved manually. Testing is critical in software quality assurance. Unit tests verify individual functions or methods in isolation, often using mocking to simulate dependencies. Integration tests verify interactions between components. End-to-end (E2E) tests simulate real user scenarios across the entire application. Test-Driven Development (TDD) follows a red-green-refactor cycle: write a failing test, implement the minimum code to pass, then refactor. CI/CD pipelines automate the build, test, and deployment process. Jenkins, GitHub Actions, and GitLab CI are popular CI/CD tools. Microservices architecture decomposes applications into small, independently deployable services that communicate via HTTP/REST or message queues like RabbitMQ or Kafka."
    })
  },

  // ════════════════════════════════════════════════════════════════════════════
  // 9. Cybersecurity Fundamentals
  // ════════════════════════════════════════════════════════════════════════════
  {
    title: "Cybersecurity Fundamentals",
    subject: "Information Technology",
    content: JSON.stringify({
      topic: "Cybersecurity Fundamentals",
      summary: "Cybersecurity is the practice of protecting systems, networks, and programs from digital attacks. It encompasses the CIA triad (Confidentiality, Integrity, Availability), common threats, defense mechanisms, and security best practices.",
      keyConcepts: [
        { term: "CIA Triad", definition: "The three core principles of information security: Confidentiality (only authorized users can access data), Integrity (data is accurate and unaltered), and Availability (systems and data are accessible when needed)." },
        { term: "Encryption", definition: "The process of converting plaintext into ciphertext using an algorithm and a key, making data unreadable to unauthorized parties. Symmetric encryption uses one shared key (AES, DES). Asymmetric encryption uses a public-private key pair (RSA, ECC)." },
        { term: "Phishing", definition: "A social engineering attack where an attacker disguises as a trusted entity to trick victims into revealing sensitive information such as passwords, credit card numbers, or personal data through fraudulent emails, messages, or websites." },
        { term: "Malware", definition: "Malicious software designed to disrupt, damage, or gain unauthorized access to computer systems. Types include viruses (attach to programs), worms (self-replicating), trojans (disguised as legitimate software), ransomware (encrypts data for ransom), and spyware (monitors activity)." },
        { term: "Firewall", definition: "A security system that monitors and controls incoming and outgoing network traffic based on predetermined rules. Types include packet-filtering (inspects individual packets), stateful inspection (tracks connection states), and application-layer (inspects application data)." },
        { term: "Multi-Factor Authentication (MFA)", definition: "A security mechanism requiring two or more verification factors to access an account: something you know (password), something you have (phone/token), and something you are (biometrics like fingerprint or face recognition)." },
        { term: "SQL Injection", definition: "A code injection attack that exploits vulnerabilities in web applications by inserting malicious SQL statements into input fields. Attackers can read, modify, or delete database contents. Prevented by using parameterized queries and input validation." },
        { term: "Cross-Site Scripting (XSS)", definition: "A vulnerability where attackers inject malicious client-side scripts into web pages viewed by other users. Types include Stored XSS (persistent), Reflected XSS (non-persistent), and DOM-based XSS. Prevented by output encoding and Content Security Policy." },
        { term: "Vulnerability Assessment", definition: "The process of identifying, quantifying, and prioritizing security weaknesses in a system. Tools like Nessus and OpenVAS scan for known vulnerabilities. A penetration test goes further by actively exploiting vulnerabilities to assess risk." },
        { term: "Zero-Day Vulnerability", definition: "A software security flaw that is unknown to the vendor and has no available patch. Zero-day attacks exploit these vulnerabilities before a fix is released, making them particularly dangerous and valuable to attackers." }
      ],
      importantFacts: [
        "The CIA Triad — Confidentiality, Integrity, and Availability — is the foundational model for information security policies and practices.",
        "AES (Advanced Encryption Standard) is a symmetric encryption algorithm that uses 128-bit, 192-bit, or 256-bit keys. AES-256 is considered virtually unbreakable with current computing technology.",
        "RSA (Rivest-Shamir-Adleman) is an asymmetric encryption algorithm where the public key encrypts data and the private key decrypts it. RSA key sizes are typically 2048 or 4096 bits.",
        "A hash function converts data of arbitrary size into a fixed-size output (hash/digest). Cryptographic hash functions like SHA-256 are one-way (cannot be reversed) and collision-resistant. Hashing is used for password storage, digital signatures, and data integrity verification.",
        "Ransomware encrypts the victim's files and demands payment (usually in cryptocurrency) for the decryption key. Notable ransomware attacks include WannaCry (2017) and Colonial Pipeline (2021).",
        "The principle of least privilege states that users and programs should be granted only the minimum level of access necessary to perform their functions, reducing the potential damage from security breaches.",
        "A DDoS (Distributed Denial of Service) attack overwhelms a target server or network with massive traffic from multiple sources, making the service unavailable to legitimate users.",
        "Social engineering attacks exploit human psychology rather than technical vulnerabilities. Besides phishing, types include pretexting (fake scenario), baiting (infected media), tailgating (following authorized person), and quid pro quo (exchanging service for information).",
        "HTTPS uses TLS certificates issued by Certificate Authorities (CAs) to verify website identity and encrypt data in transit. A TLS certificate contains the domain name, public key, issuer, and validity period.",
        "A VPN (Virtual Private Network) creates an encrypted tunnel between a user's device and a VPN server, masking the user's IP address and encrypting all internet traffic."
      ],
      detailedContent: "Cybersecurity protects information systems from unauthorized access, theft, damage, and disruption. The CIA Triad provides the core framework: Confidentiality ensures that sensitive information is accessed only by authorized individuals through mechanisms like encryption, access controls, and authentication. Integrity ensures that data remains accurate and unaltered through checksums, hash functions, and digital signatures. Availability ensures systems and data remain accessible through redundancy, failover systems, and DDoS protection. Encryption is a fundamental defense. Symmetric encryption (AES) uses the same key for encryption and decryption, offering fast performance for large data. Asymmetric encryption (RSA, ECC) uses a key pair — the public key encrypts and the private key decrypts. Hybrid encryption combines both: asymmetric encryption securely exchanges a symmetric session key, which then encrypts the actual data. Digital signatures use the sender's private key to sign a hash of the message, which the recipient verifies with the sender's public key, ensuring both integrity and authentication. Password security requires strong hashing. Passwords should never be stored in plaintext. Instead, they are hashed using algorithms like bcrypt, scrypt, or Argon2, which include a salt (random data) and are designed to be computationally expensive to resist brute-force attacks. Network security employs multiple layers of defense. Firewalls filter traffic based on rules. Intrusion Detection Systems (IDS) monitor network traffic for suspicious patterns. Intrusion Prevention Systems (IPS) actively block detected threats. Web application security addresses vulnerabilities like SQL injection, where attackers insert malicious SQL code into user inputs to manipulate databases. Parameterized queries (prepared statements) prevent this by separating SQL code from user data. Cross-Site Scripting (XSS) is prevented by encoding output, using Content Security Policy (CSP) headers, and sanitizing user input. Cross-Site Request Forgery (CSRF) is prevented by using anti-CSRF tokens that verify the request originated from the legitimate website."
    })
  },

  // ════════════════════════════════════════════════════════════════════════════
  // 10. Artificial Intelligence and Machine Learning
  // ════════════════════════════════════════════════════════════════════════════
  {
    title: "Artificial Intelligence and Machine Learning",
    subject: "Computer Science",
    content: JSON.stringify({
      topic: "Artificial Intelligence and Machine Learning",
      summary: "Artificial Intelligence (AI) is the simulation of human intelligence in machines. Machine Learning (ML) is a subset of AI that enables systems to learn and improve from experience without being explicitly programmed. Deep Learning uses multi-layered neural networks for complex pattern recognition.",
      keyConcepts: [
        { term: "Supervised Learning", definition: "A type of machine learning where the model is trained on labeled data — input-output pairs where the correct answer is known. The model learns to map inputs to outputs and can predict labels for new, unseen data. Examples include classification and regression." },
        { term: "Unsupervised Learning", definition: "A type of machine learning where the model is trained on unlabeled data and must find hidden patterns or structures. Common techniques include clustering (K-means, hierarchical) and dimensionality reduction (PCA, t-SNE)." },
        { term: "Neural Network", definition: "A computational model inspired by the human brain, consisting of interconnected layers of nodes (neurons). Each connection has a weight that is adjusted during training. Neural networks consist of an input layer, one or more hidden layers, and an output layer." },
        { term: "Deep Learning", definition: "A subset of machine learning using neural networks with many hidden layers (deep networks). Deep learning excels at complex tasks like image recognition (CNNs), natural language processing (transformers), and speech recognition (RNNs/LSTMs)." },
        { term: "Overfitting", definition: "A modeling error where a machine learning model learns the training data too well, including its noise and outliers, resulting in excellent training performance but poor generalization to new data. Prevented by regularization, cross-validation, and dropout." },
        { term: "Training, Validation, and Test Sets", definition: "Data is split into three subsets: the training set (used to train the model, typically 60-80%), the validation set (used to tune hyperparameters and prevent overfitting, 10-20%), and the test set (used for final evaluation, 10-20%)." },
        { term: "Gradient Descent", definition: "An optimization algorithm used to minimize the loss function by iteratively adjusting model parameters in the direction of steepest descent. Learning rate controls the step size. Variants include Stochastic Gradient Descent (SGD), Mini-batch GD, and Adam optimizer." },
        { term: "Natural Language Processing (NLP)", definition: "A field of AI focused on enabling machines to understand, interpret, and generate human language. Tasks include text classification, sentiment analysis, machine translation, named entity recognition, and question answering." },
        { term: "Convolutional Neural Network (CNN)", definition: "A deep learning architecture designed for processing grid-like data such as images. CNNs use convolutional layers with learnable filters to detect features like edges, textures, and objects. Pooling layers reduce spatial dimensions." },
        { term: "Reinforcement Learning", definition: "A type of machine learning where an agent learns to make decisions by interacting with an environment. The agent receives rewards or penalties for its actions and learns a policy that maximizes cumulative reward over time." }
      ],
      importantFacts: [
        "The three main types of machine learning are supervised learning (labeled data), unsupervised learning (unlabeled data), and reinforcement learning (reward-based learning from environment interaction).",
        "A loss function (or cost function) measures how far the model's predictions are from the actual values. Common loss functions include Mean Squared Error (MSE) for regression and Cross-Entropy Loss for classification.",
        "The bias-variance tradeoff describes the tension between a model's ability to fit training data (low bias) and its ability to generalize to new data (low variance). High bias leads to underfitting; high variance leads to overfitting.",
        "Transfer learning is a technique where a model trained on one task is reused as the starting point for a different but related task. For example, a model pre-trained on ImageNet can be fine-tuned for medical image classification.",
        "The Turing Test, proposed by Alan Turing in 1950, evaluates a machine's ability to exhibit intelligent behavior indistinguishable from a human. If a human evaluator cannot distinguish the machine from a human in conversation, the machine is said to pass.",
        "K-Nearest Neighbors (KNN) is a simple classification algorithm that assigns a new data point the majority class of its K nearest neighbors in feature space. It requires no training but is computationally expensive at prediction time.",
        "Decision Trees split data based on feature values to make predictions. Random Forests combine multiple decision trees (ensemble learning) to improve accuracy and reduce overfitting.",
        "Backpropagation is the algorithm used to train neural networks by computing gradients of the loss function with respect to each weight using the chain rule, then updating weights via gradient descent.",
        "The transformer architecture, introduced in the 2017 paper 'Attention Is All You Need,' uses self-attention mechanisms and has become the foundation for modern NLP models like BERT, GPT, and T5.",
        "Precision measures the proportion of positive predictions that are actually correct, while recall measures the proportion of actual positives that were correctly identified. The F1 score is the harmonic mean of precision and recall."
      ],
      detailedContent: "Artificial Intelligence encompasses all techniques that enable machines to mimic human cognitive functions. Machine Learning is the dominant AI paradigm today, where algorithms learn patterns from data rather than following explicit rules. In supervised learning, the model is given training examples with known labels. Classification tasks assign discrete categories (spam or not spam), while regression tasks predict continuous values (house prices). Common algorithms include Linear Regression (models linear relationships), Logistic Regression (binary classification despite the name), Support Vector Machines (find optimal hyperplane separating classes), Decision Trees (hierarchical if-then rules), and Random Forests (ensemble of decision trees). Model evaluation metrics include accuracy, precision, recall, F1 score, and AUC-ROC. Accuracy measures overall correct predictions. Precision is true positives divided by all positive predictions. Recall is true positives divided by all actual positives. Unsupervised learning discovers hidden structure in unlabeled data. K-Means clustering partitions data into K groups by minimizing the distance between points and their cluster centroid. Principal Component Analysis (PCA) reduces dimensionality while preserving maximum variance. Neural networks consist of layers of artificial neurons. Each neuron computes a weighted sum of inputs, adds a bias, and applies an activation function (ReLU, sigmoid, tanh, softmax). Training uses backpropagation: the forward pass computes predictions, the loss function measures error, and the backward pass computes gradients using the chain rule. Gradient descent updates weights to minimize loss. Deep learning architectures include CNNs (convolutional layers for spatial feature extraction in images), RNNs (recurrent connections for sequential data like text and time series), LSTMs (Long Short-Term Memory networks that solve RNN's vanishing gradient problem), and Transformers (self-attention mechanisms for parallel processing of sequences). The transformer architecture powers modern language models. Self-attention allows each token to attend to every other token in the sequence, capturing long-range dependencies. GPT models use decoder-only transformers for text generation. BERT uses encoder-only transformers for language understanding. Reinforcement learning trains agents through trial and error in an environment, using reward signals to learn optimal policies."
    })
  }
];

// ─── Seed Function ──────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 Starting reviewer seed...\n");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    let created = 0;
    let skipped = 0;

    for (const reviewer of reviewers) {
      // Check if a lesson with the same title already exists
      const existing = await pool.query(
        'SELECT id FROM "Lesson" WHERE title = $1',
        [reviewer.title]
      );

      if (existing.rows.length > 0) {
        console.log(`⏭️  Skipped (already exists): ${reviewer.title}`);
        skipped++;
        continue;
      }

      await pool.query(
        `INSERT INTO "Lesson" (id, title, subject, content, "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())`,
        [reviewer.title, reviewer.subject, reviewer.content]
      );

      console.log(`✅ Created: ${reviewer.title} [${reviewer.subject}]`);
      created++;
    }

    console.log(`\n📊 Summary: ${created} created, ${skipped} skipped`);
    console.log("🎓 All reviewers are now available in the Lesson dropdown for quiz generation!\n");

    await pool.end();
  } catch (error) {
    console.error("❌ Error seeding reviewers:", error);
    await pool.end();
    throw error;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
