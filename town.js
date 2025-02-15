import { create, Client } from "@open-wa/wa-automate";
import { GoogleSpreadsheet } from "google-spreadsheet";
import dotenv from "dotenv";

dotenv.config();

// Course Information
const courses = {
  "Fullstack Web Development": {
    url: "https://univelcity.com/portfolio/fullstack-web-development/",
    price: "₦1,000,000",
    duration: "6 Months",
    delivery: "Physical & Online"
  },
  "Frontend Web Development with ReactJS": {
    url: "https://univelcity.com/portfolio/frontend-web-development-with-react-js/",
    price: "₦350,000",
    duration: "12 Weeks",
    delivery: "Physical & Online"
  },
  "Backend with Python Django": {
    url: "https://univelcity.com/portfolio/backend-with-python-django/",
    price: "₦350,000",
    duration: "12 Weeks",
    delivery: "Physical & Online"
  },
  "Python For Datascience": {
    url: "https://univelcity.com/portfolio/python-for-datascience/",
    price: "₦350,000",
    duration: "12 Weeks",
    delivery: "Physical & Online"
  },
  "UI/UX Design and Prototyping": {
    url: "https://univelcity.com/portfolio/ui-ux-design-and-prototyping/",
    price: "₦350,000",
    duration: "12 Weeks",
    delivery: "Physical & Online"
  },
  "Cybersecurity(Ethical Hacking)": {
    url: "https://univelcity.com/portfolio/ethical-hacking-and-counter-measures/",
    price: "₦350,000",
    duration: "12 Weeks",
    delivery: "Physical & Online"
  }
};

// Google Sheets Setup
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID);
const serviceAccount = {
  client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
};

// Load Leads from Google Sheet
async function loadLeads() {
  try {
    await doc.useServiceAccountAuth(serviceAccount);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0]; // First sheet
    const rows = await sheet.getRows();

    return rows.map(row => ({
      name: row.Name,
      phone: row["Phone Number"],
      course: row["Course Interest"],
      status: row.Status,
      response: row.Response,
      source: row.Source, // New Column for Lead Source
      rowRef: row
    }));
  } catch (error) {
    console.error("❌ Error loading Google Sheet data:", error);
    return [];
  }
}

// Function to Add New User to Google Sheets
async function addNewUser(phone) {
  try {
    await doc.useServiceAccountAuth(serviceAccount);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];

    const newRow = await sheet.addRow({
      Name: "", // Name to be filled later
      "Phone Number": phone,
      "Course Interest": "",
      Status: "New User",
      Response: "",
      Source: "UniBot" // Set source as "Bot"
    });

    return newRow;
  } catch (error) {
    console.error("❌ Error adding new user to Google Sheet:", error);
  }
}

// Start WhatsApp Automation
create().then(client => {
  start(client);

  // **Schedule Job to Check for New Leads Every Hour**
  setInterval(() => start(client), 60 * 60 * 1000); // Runs every 1 hour
});

async function start(client) {
  const leads = await loadLeads();

  // Listen for User Messages
  client.onMessage(async message => {
    try {
      const phone = message.from.replace("@c.us", "");
      let lead = leads.find(l => l.phone === phone);

      if (!lead) {
        // **New User Detected**
        await client.sendText(message.from, `👋 Welcome to *Univelcity*! 🎉 We train individuals in high-demand tech skills. **What's your name?** 😊`);
        const newRow = await addNewUser(phone);
        return;
      }

      // **If user exists but has no name, assume they just gave their name**
      if (!lead.name || lead.name === "") {
        lead.rowRef.Name = message.body; // Save the user's name
        await lead.rowRef.save();
        await client.sendText(message.from, `Nice to meet you, *${message.body}*! 🎉 Here are the courses we offer at Univelcity:\n\n` +
          `1️⃣ Fullstack Web Development\n` +
          `2️⃣ Frontend Web Development with ReactJS\n` +
          `3️⃣ Backend with Python Django\n` +
          `4️⃣ Python For Data Science\n` +
          `5️⃣ UI/UX Design and Prototyping\n` +
          `6️⃣ Cybersecurity (Ethical Hacking)\n\n` +
          `Reply with the course number (e.g., "1" for Fullstack Web Development) to learn more.`);
        return;
      }

      // **If user is choosing a course**
      if (lead.course === "") {
        const courseNumbers = ["1", "2", "3", "4", "5", "6"];
        if (courseNumbers.includes(message.body.trim())) {
          const selectedCourse = Object.keys(courses)[parseInt(message.body.trim()) - 1];
          lead.rowRef["Course Interest"] = selectedCourse;
          await lead.rowRef.save();

          const course = courses[selectedCourse];
          await client.sendText(message.from, `Great choice! Here are the details for *${selectedCourse}*:\n\n` +
            `📌 *Price:* ${course.price}\n` +
            `⏳ *Duration:* ${course.duration}\n` +
            `🖥️ *Mode:* ${course.delivery}\n` +
            `🔗 *Learn More & Enroll:* ${course.url}\n\n` +
            `👉 Would you like to know about our payment plans? 😊`);
          return;
        } else {
          await client.sendText(message.from, `Please reply with the correct course number (1-6) to proceed. 😊`);
          return;
        }
      }

      // **If user asks about installment payments**
      if (message.body.toLowerCase().includes("installment") || message.body.toLowerCase().includes("credit")) {
        await client.sendText(message.from, `We accept installment payments! 💳 This is managed by our partner *Advancely*. You can sign up for a credit offer here: https://credit.advancly.com/univel/sign-up. Let me know if you need help! 😊`);
        lead.rowRef.Status = "Asked for Installment";
        await lead.rowRef.save();
        return;
      }

      // **If user says they are not interested**
      if (message.body.toLowerCase().includes("not interested")) {
        await client.sendText(message.from, `No problem, ${lead.name}! 😊 Thank you for your time, and I wish you all the best in your journey. Feel free to reach out if you change your mind.`);
        lead.rowRef.Status = "Not Interested";
        await lead.rowRef.save();
        return;
      }

      // **Default Response**
      await client.sendText(message.from, `Thanks for reaching out, ${lead.name}! 😊 Our team is here to help. Let me know if you have any questions. Meanwhile, you can check our courses here: https://univelcity.com/courses`);
      lead.rowRef.Status = "Needs Human Follow-up";
      lead.rowRef.Response = message.body;
      await lead.rowRef.save();
      
    } catch (error) {
      console.error("❌ Error handling WhatsApp reply:", error);
    }
  });
}
