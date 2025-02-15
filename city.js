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
  await doc.useServiceAccountAuth(serviceAccount);
  await doc.loadInfo();

  const sheet = doc.sheetsByIndex[0]; // First sheet
  const rows = await sheet.getRows();

  return rows.map(row => ({
    name: row.Name,
    phone: row["Phone Number"],
    course: row["Course Interest"],
    status: row.Status,
    response: row.Response, // New Column for User Responses
    rowRef: row
  }));
}

// Start WhatsApp Automation
create().then(client => {
  start(client);

  // **Schedule Job to Check for New Leads Every Hour**
  setInterval(() => start(client), 60 * 60 * 1000); // Runs every 1 hour
});

async function start(client) {
  const leads = await loadLeads();

  for (const lead of leads) {
    if (lead.status === "Pending") {
      const course = courses[lead.course] || null;
      if (!course) continue; // Skip if course not found

      const message = `Hey ${lead.name}, thanks for your interest in our ${lead.course} course! 🚀 Here are the details:\n\n` +
        `📌 *Price:* ${course.price}\n` +
        `⏳ *Duration:* ${course.duration}\n` +
        `🖥️ *Mode:* ${course.delivery}\n` +
        `🔗 *Learn More & Enroll:* ${course.url}\n\n` +
        `👉 Would you like to know about our payment plans? 😊`;

      try {
        await client.sendText(lead.phone + "@c.us", message);
        console.log(`✅ Message sent to ${lead.name}`);

        // Update Google Sheet Status
        lead.rowRef.Status = "Message Sent";
        await lead.rowRef.save();
      } catch (error) {
        console.log(`❌ Failed to send message to ${lead.name}`, error);
      }
    }
  }

  // Listen for Replies
  client.onMessage(async message => {
    const phone = message.from.replace("@c.us", "");
    const lead = leads.find(l => l.phone === phone);

    if (lead) {
      const response = message.body.toLowerCase();

      if (response.includes("interested") || response.includes("tell me more")) {
        await client.sendText(message.from, `Awesome, ${lead.name}! 🎉 You can register directly here: ${courses[lead.course].url}\n\n💳 We offer flexible payment plans. Would you like me to send details? 😊`);
        lead.rowRef.Status = "Interested - Sent Details";
      } 
      else if (response.includes("price") || response.includes("cost") || response.includes("fee")) {
        await client.sendText(message.from, `The tuition for ${lead.course} is ${courses[lead.course].price}. 💰\n\nWe also offer flexible payment plans. Would you like me to send those options?`);
        lead.rowRef.Status = "Asked for Pricing";
      } 
      else if (response.includes("not now") || response.includes("later")) {
        await client.sendText(message.from, `No problem, ${lead.name}! 😊 I'll check back in later. Meanwhile, feel free to explore our courses: https://univelcity.com/courses`);
        lead.rowRef.Status = "Not Interested Now";
      } 
      else if (response.includes("payment plan") || response.includes("installment")) {
        await client.sendText(message.from, `We offer payment plans! 💳 You can pay in installments. Our advisor can share the details with you. Would you like to schedule a quick chat? 😊`);
        lead.rowRef.Status = "Asked for Payment Plan";
      }
      else {
        await client.sendText(message.from, `Thanks for reaching out, ${lead.name}! 😊 Our team is here to help. Let me know if you have any questions. Meanwhile, you can check our courses here: https://univelcity.com/courses`);
        lead.rowRef.Status = "Needs Human Follow-up";
      }

      // **Log the User's Response in Google Sheet**
      lead.rowRef.Response = message.body; // Store user response in the "Response" column
      await lead.rowRef.save();
    }
  });
}

