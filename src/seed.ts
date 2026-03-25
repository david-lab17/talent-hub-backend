import "dotenv/config";
import bcrypt from "bcryptjs";
import { db, adminUsersTable, assessmentsTable, questionsTable, testCasesTable } from "./db/index.js";
import { logger } from "./lib/logger.js";

async function seed() {
  logger.info("Starting database seed...");

  // Create default admin user
  const passwordHash = await bcrypt.hash("admin123", 10);

  const [admin] = await db.insert(adminUsersTable).values({
    email: "admin@example.com",
    passwordHash,
    name: "Admin User",
  }).onConflictDoNothing().returning();

  if (admin) {
    logger.info({ email: admin.email }, "Created admin user");
  } else {
    logger.info("Admin user already exists");
  }

  // Create sample assessment
  const [assessment] = await db.insert(assessmentsTable).values({
    title: "JavaScript Fundamentals",
    description: "Test your knowledge of JavaScript basics including functions, arrays, and string manipulation.",
    timeLimitMinutes: 45,
    status: "published",
    passThreshold: 70,
  }).returning();

  logger.info({ id: assessment.id, title: assessment.title }, "Created assessment");

  // Create sample questions
  const question1 = await db.insert(questionsTable).values({
    assessmentId: assessment.id,
    title: "Two Sum",
    description: `# Two Sum

Given an array of integers \`nums\` and an integer \`target\`, return the indices of the two numbers such that they add up to \`target\`.

You may assume that each input would have exactly one solution, and you may not use the same element twice.

## Example

**Input:** nums = [2, 7, 11, 15], target = 9
**Output:** [0, 1]
**Explanation:** Because nums[0] + nums[1] == 9, we return [0, 1].

## Constraints

- 2 <= nums.length <= 10^4
- -10^9 <= nums[i] <= 10^9
- -10^9 <= target <= 10^9
- Only one valid answer exists.`,
    difficulty: "easy",
    points: 100,
    orderIndex: 0,
    starterCode: `function solution(input) {
  // Parse input
  const lines = input.trim().split('\\n');
  const nums = JSON.parse(lines[0]);
  const target = parseInt(lines[1]);

  // Your code here

  return result;
}`,
  }).returning();

  // Add test cases for question 1
  await db.insert(testCasesTable).values([
    {
      questionId: question1[0].id,
      input: "[2,7,11,15]\n9",
      expectedOutput: "[0,1]",
      isHidden: false,
      label: "Example 1",
    },
    {
      questionId: question1[0].id,
      input: "[3,2,4]\n6",
      expectedOutput: "[1,2]",
      isHidden: false,
      label: "Example 2",
    },
    {
      questionId: question1[0].id,
      input: "[3,3]\n6",
      expectedOutput: "[0,1]",
      isHidden: true,
      label: "Hidden Test 1",
    },
  ]);

  const question2 = await db.insert(questionsTable).values({
    assessmentId: assessment.id,
    title: "Reverse String",
    description: `# Reverse String

Write a function that reverses a string. The input string is given as an array of characters.

You must do this by modifying the input array in-place.

## Example

**Input:** ["h","e","l","l","o"]
**Output:** ["o","l","l","e","h"]

## Constraints

- 1 <= s.length <= 10^5
- s[i] is a printable ascii character.`,
    difficulty: "easy",
    points: 100,
    orderIndex: 1,
    starterCode: `function solution(input) {
  const s = JSON.parse(input.trim());

  // Your code here - reverse the array in place

  return JSON.stringify(s);
}`,
  }).returning();

  // Add test cases for question 2
  await db.insert(testCasesTable).values([
    {
      questionId: question2[0].id,
      input: '["h","e","l","l","o"]',
      expectedOutput: '["o","l","l","e","h"]',
      isHidden: false,
      label: "Example 1",
    },
    {
      questionId: question2[0].id,
      input: '["H","a","n","n","a","h"]',
      expectedOutput: '["h","a","n","n","a","H"]',
      isHidden: false,
      label: "Example 2",
    },
    {
      questionId: question2[0].id,
      input: '["a"]',
      expectedOutput: '["a"]',
      isHidden: true,
      label: "Hidden Test 1",
    },
  ]);

  logger.info("Database seed completed!");
  logger.info("\nDefault admin credentials:");
  logger.info("  Email: admin@example.com");
  logger.info("  Password: admin123");

  process.exit(0);
}

seed().catch((err) => {
  logger.error({ err }, "Seed failed");
  process.exit(1);
});
