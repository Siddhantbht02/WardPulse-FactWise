import { PrismaClient } from "@prisma/client";
import { getFacilityLocalDate } from "../src/lib/rules";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting WardPulse comprehensive seed...");

  // 1. Settings
  await prisma.facilitySettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      feverThreshold: 38.0,
      requiredFeverFreeDays: 3,
      benchmarkMortality: 0.15,
      timezone: "Asia/Kolkata",
      tempCutoffHour: 12,
      doctorCutoffHour: 17,
      demoMode: true,
    },
  });

  // 2. Clear existing dynamic data for clean idempotent re-seed
  await prisma.auditLog.deleteMany();
  await prisma.heartbeatLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.dischargeEvent.deleteMany();
  await prisma.nurseClaim.deleteMany();
  await prisma.tempRequest.deleteMany();
  await prisma.doctorVisit.deleteMany();
  await prisma.temperatureReading.deleteMany();
  await prisma.waitlistEntry.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.room.deleteMany();
  await prisma.user.deleteMany();

  // 3. Create Staff Users
  const users = await prisma.$transaction([
    // Admins
    prisma.user.create({
      data: {
        id: "u-admin-1",
        name: "Dr. Sarah Chen",
        role: "ADMIN",
        pin: "1111",
        avatar: "SC",
        isDemo: true,
      },
    }),
    prisma.user.create({
      data: {
        id: "u-admin-2",
        name: "Marcus Vance",
        role: "ADMIN",
        pin: "1122",
        avatar: "MV",
        isDemo: true,
      },
    }),
    // Doctors
    prisma.user.create({
      data: {
        id: "u-doc-1",
        name: "Dr. Priya Sharma",
        role: "DOCTOR",
        pin: "2222",
        avatar: "PS",
        isDemo: true,
      },
    }),
    prisma.user.create({
      data: {
        id: "u-doc-2",
        name: "Dr. Robert Kim",
        role: "DOCTOR",
        pin: "2233",
        avatar: "RK",
        isDemo: true,
      },
    }),
    prisma.user.create({
      data: {
        id: "u-doc-3",
        name: "Dr. Ananya Iyer",
        role: "DOCTOR",
        pin: "2244",
        avatar: "AI",
        isDemo: true,
      },
    }),
    // Nurses
    prisma.user.create({
      data: {
        id: "u-nurse-1",
        name: "Anita Patel",
        role: "NURSE",
        pin: "3333",
        avatar: "AP",
        isDemo: true,
      },
    }),
    prisma.user.create({
      data: {
        id: "u-nurse-2",
        name: "John Mwangi",
        role: "NURSE",
        pin: "3344",
        avatar: "JM",
        isDemo: true,
      },
    }),
    prisma.user.create({
      data: {
        id: "u-nurse-3",
        name: "Maria Gomez",
        role: "NURSE",
        pin: "3355",
        avatar: "MG",
        isDemo: true,
      },
    }),
    prisma.user.create({
      data: {
        id: "u-nurse-4",
        name: "David Zhao",
        role: "NURSE",
        pin: "3366",
        avatar: "DZ",
        isDemo: true,
      },
    }),
    prisma.user.create({
      data: {
        id: "u-nurse-5",
        name: "Sunita Rao",
        role: "NURSE",
        pin: "3377",
        avatar: "SR",
        isDemo: true,
      },
    }),
    prisma.user.create({
      data: {
        id: "u-nurse-6",
        name: "Carlos Ruiz",
        role: "NURSE",
        pin: "3388",
        avatar: "CR",
        isDemo: true,
      },
    }),
  ]);

  const admin1 = users[0];
  const doc1 = users[2];
  const doc2 = users[3];
  const nurse1 = users[5];
  const nurse2 = users[6];

  // 4. Create 74 Rooms (Sections A to E)
  const roomData = [];
  const sections = ["A", "B", "C", "D", "E"];
  for (let i = 1; i <= 74; i++) {
    const sec = sections[Math.floor((i - 1) / 15)] || "E";
    const roomNumber = `${sec}-${String(i).padStart(2, "0")}`;
    roomData.push({
      id: i,
      roomNumber,
      section: sec,
      status: "OCCUPIED",
    });
  }
  await prisma.room.createMany({ data: roomData });

  // 5. Generate Dates
  const now = new Date();
  const todayStr = getFacilityLocalDate(now);
  const getOffsetDateStr = (daysAgo: number) => {
    const d = new Date(now.getTime() - daysAgo * 86400000);
    return getFacilityLocalDate(d);
  };
  const d1 = getOffsetDateStr(1);
  const d2 = getOffsetDateStr(2);
  const d3 = getOffsetDateStr(3);
  const d4 = getOffsetDateStr(4);
  const d5 = getOffsetDateStr(5);

  // 6. First names & Last names for realism
  const firstNames = [
    "Aarav", "Meera", "Vikram", "Sneha", "Karan", "Pooja", "Rohan", "Divya",
    "Aditya", "Neha", "Arjun", "Kavita", "Suresh", "Lakshmi", "Rajesh", "Sunita",
    "Amit", "Deepa", "Manish", "Anjali", "Sanjay", "Geeta", "Nikhil", "Swati",
    "Ashok", "Rekha", "Vijay", "Preeti", "Harish", "Shweta", "Mohan", "Kiran",
    "Gaurav", "Simran", "Rahul", "Nisha", "Pradeep", "Rashmi", "Alok", "Vandana",
    "Tushar", "Meenakshi", "Pankaj", "Renu", "Mahesh", "Sangeeta", "Dinesh", "Usha",
    "Ravi", "Madhu", "Anil", "Bhavna", "Kailash", "Kamla", "Mukesh", "Sarita",
    "Ramesh", "Vidya", "Sunil", "Asha", "Naresh", "Pushpa", "Satish", "Shashi",
    "Jagdish", "Chitra", "Om", "Suman", "Vinod", "Shanti", "Bharat", "Santosh",
    "Yash", "Tanvi"
  ];

  const lastNames = [
    "Sharma", "Verma", "Patel", "Mehta", "Deshmukh", "Kulkarni", "Gupta", "Joshi",
    "Iyer", "Nair", "Reddy", "Rao", "Chopra", "Malhotra", "Kapoor", "Bhatia",
    "Banerjee", "Chatterjee", "Bose", "Dutta", "Singh", "Kaur", "Gill", "Sandhu"
  ];

  console.log("Seeding 74 current active patients...");
  const readingsToInsert = [];
  const visitsToInsert = [];
  const notificationsToInsert = [];
  const dischargeEventsToInsert = [];

  for (let i = 1; i <= 74; i++) {
    const fn = firstNames[(i - 1) % firstNames.length];
    const ln = lastNames[(i * 3) % lastNames.length];
    const patientName = `${fn} ${ln}`;
    const age = 22 + ((i * 7) % 65);
    const sex = i % 2 === 0 ? "Female" : "Male";
    const emergencyContact = `Spouse / Family (+91 98${String(10000000 + i * 8321).slice(0, 8)})`;
    const contactPhone = `+91 98${String(10000000 + i * 8321).slice(0, 8)}`;

    // Varied clinical profiles:
    // Room 1-5: DISCHARGE ELIGIBLE (3 full fever-free days completed!)
    // Room 6-20: READY_FOR_DOCTOR (Measured today, needs doctor visit)
    // Room 21-40: NEEDS_TEMP (Morning queue, not yet measured today)
    // Room 41-55: SEEN (Measured today AND visited by doctor today)
    // Room 56-65: OVERDUE (Needs temp, with urgent doctor requests)
    // Room 66-74: High fever today or fluctuating symptoms
    let patientStatus = "UNDER_TREATMENT";
    let isDischargeEligible = false;

    if (i <= 5) {
      patientStatus = "DISCHARGE_ELIGIBLE";
      isDischargeEligible = true;
    }

    const patient = await prisma.patient.create({
      data: {
        id: `pat-${i}`,
        name: patientName,
        age,
        sex,
        emergencyContact,
        contactPhone,
        symptoms: i % 3 === 0 ? "Prolonged dry cough, fatigue" : "High fever, chills, mild dyspnea",
        severity: i % 4 === 0 ? "SEVERE" : i % 2 === 0 ? "MODERATE" : "MILD",
        status: patientStatus,
        roomId: i,
        admittedAt: new Date(now.getTime() - (5 + (i % 6)) * 86400000),
      },
    });

    // Readings generation based on archetype:
    if (i <= 5) {
      // 3 full fever-free days!
      readingsToInsert.push(
        { patientId: patient.id, valueC: 36.8, recordedById: nurse1.id, localDate: d3, recordedAt: new Date(now.getTime() - 3 * 86400000 + 36000000) },
        { patientId: patient.id, valueC: 36.7, recordedById: nurse2.id, localDate: d2, recordedAt: new Date(now.getTime() - 2 * 86400000 + 34000000) },
        { patientId: patient.id, valueC: 36.6, recordedById: nurse1.id, localDate: d1, recordedAt: new Date(now.getTime() - 1 * 86400000 + 33000000) },
        { patientId: patient.id, valueC: 36.5, recordedById: nurse1.id, localDate: todayStr, recordedAt: new Date(now.getTime() - 7200000) }
      );
      visitsToInsert.push({
        patientId: patient.id,
        doctorId: doc1.id,
        localDate: todayStr,
        visitedAt: new Date(now.getTime() - 5400000),
        clinicalNote: "Lungs clear bilaterally. Vitals stable. Streak 3 achieved.",
        treatmentPlan: "Fit for discharge. Awaiting admin clearance.",
        medication: "Supportive vitamins, oral hydration",
      });
      dischargeEventsToInsert.push({
        patientId: patient.id,
        eligibleAt: new Date(now.getTime() - 3600000),
        summaryJson: JSON.stringify({
          feverFreeDates: [d3, d2, d1, todayStr],
          maxTemps: [36.8, 36.7, 36.6, 36.5],
        }),
      });
      notificationsToInsert.push({
        role: "ADMIN",
        title: "Discharge Ready",
        message: `Room ${i} (${patient.name}) has reached 3 consecutive fever-free days and is ready for discharge.`,
        type: "SUCCESS",
        link: `/discharge?room=${i}`,
      });
    } else if (i <= 20) {
      // READY FOR DOCTOR: Measured today, no doctor visit yet
      readingsToInsert.push(
        { patientId: patient.id, valueC: 38.3, recordedById: nurse1.id, localDate: d2, recordedAt: new Date(now.getTime() - 2 * 86400000 + 35000000) },
        { patientId: patient.id, valueC: 37.4, recordedById: nurse2.id, localDate: d1, recordedAt: new Date(now.getTime() - 1 * 86400000 + 36000000) },
        { patientId: patient.id, valueC: i % 2 === 0 ? 38.4 : 37.2, recordedById: nurse1.id, localDate: todayStr, recordedAt: new Date(now.getTime() - 7200000) }
      );
    } else if (i <= 40) {
      // NEEDS TEMP: History in past days, but NOT measured today
      readingsToInsert.push(
        { patientId: patient.id, valueC: 38.2, recordedById: nurse2.id, localDate: d2, recordedAt: new Date(now.getTime() - 2 * 86400000 + 36000000) },
        { patientId: patient.id, valueC: 37.9, recordedById: nurse1.id, localDate: d1, recordedAt: new Date(now.getTime() - 1 * 86400000 + 37000000) }
      );
    } else if (i <= 55) {
      // SEEN: Measured and seen today
      readingsToInsert.push(
        { patientId: patient.id, valueC: 37.0, recordedById: nurse1.id, localDate: d1, recordedAt: new Date(now.getTime() - 1 * 86400000 + 36000000) },
        { patientId: patient.id, valueC: 36.9, recordedById: nurse2.id, localDate: todayStr, recordedAt: new Date(now.getTime() - 14400000) }
      );
      visitsToInsert.push({
        patientId: patient.id,
        doctorId: doc2.id,
        localDate: todayStr,
        visitedAt: new Date(now.getTime() - 10800000),
        clinicalNote: "Regular rounds complete. Patient resting comfortably.",
        treatmentPlan: "Continue current symptomatic protocol.",
        medication: "Paracetamol PRN",
      });
    } else if (i <= 65) {
      // OVERDUE / URGENT REQUEST: Needs temp, and doctor requested temperature!
      readingsToInsert.push({
        patientId: patient.id,
        valueC: 38.6,
        recordedById: nurse1.id,
        localDate: d1,
        recordedAt: new Date(now.getTime() - 1 * 86400000 + 36000000),
      });
      await prisma.tempRequest.create({
        data: {
          patientId: patient.id,
          doctorId: doc1.id,
          priority: "URGENT",
          status: "PENDING",
          requestedAt: new Date(now.getTime() - 3600000),
        },
      });
    } else {
      // High fever today
      readingsToInsert.push(
        { patientId: patient.id, valueC: 38.8, recordedById: nurse1.id, localDate: d1, recordedAt: new Date(now.getTime() - 1 * 86400000 + 36000000) },
        { patientId: patient.id, valueC: 39.1, recordedById: nurse2.id, localDate: todayStr, recordedAt: new Date(now.getTime() - 5000000) }
      );
      visitsToInsert.push({
        patientId: patient.id,
        doctorId: doc1.id,
        localDate: todayStr,
        visitedAt: new Date(now.getTime() - 2000000),
        clinicalNote: "Fever spike to 39.1°C. Antipyretic IV administered.",
        treatmentPlan: "Monitor hourly. Re-measure temperature at 4 PM.",
        medication: "IV Paracetamol 1g, Saline infusion",
      });
    }
  }

  // Insert readings and visits
  console.log(`Inserting ${readingsToInsert.length} readings and ${visitsToInsert.length} visits...`);
  await prisma.temperatureReading.createMany({ data: readingsToInsert });
  await prisma.doctorVisit.createMany({ data: visitsToInsert });
  await prisma.dischargeEvent.createMany({ data: dischargeEventsToInsert });
  await prisma.notification.createMany({ data: notificationsToInsert });

  // 7. Seed ~120 historical closed cases (~15% mortality = ~18 deaths, ~102 discharged)
  console.log("Seeding ~120 historical closed cases for Wilson CI benchmark analytics...");
  const historicalPatients = [];
  const totalHistorical = 120;
  const targetDeaths = 18; // 18 / 120 = 15.0%

  for (let j = 1; j <= totalHistorical; j++) {
    const isDeath = j <= targetDeaths;
    const admitDaysAgo = 10 + (j % 30);
    const closeDaysAgo = admitDaysAgo - (3 + (j % 6));

    historicalPatients.push({
      id: `pat-hist-${j}`,
      name: `Historical Patient ${j}`,
      age: 30 + ((j * 11) % 55),
      sex: j % 2 === 0 ? "Female" : "Male",
      emergencyContact: `Family (+91 97${String(20000000 + j * 4321).slice(0, 8)})`,
      contactPhone: `+91 97${String(20000000 + j * 4321).slice(0, 8)}`,
      status: isDeath ? "DECEASED" : "DISCHARGED",
      admittedAt: new Date(now.getTime() - admitDaysAgo * 86400000),
      dischargedAt: isDeath ? null : new Date(now.getTime() - closeDaysAgo * 86400000),
      deceasedAt: isDeath ? new Date(now.getTime() - closeDaysAgo * 86400000) : null,
      dischargeNotes: isDeath ? null : "Patient achieved 3 fever-free days and successfully discharged.",
      deceasedCause: isDeath ? "Severe acute respiratory distress syndrome" : null,
    });
  }

  await prisma.patient.createMany({ data: historicalPatients });

  // 8. Seed Waitlist (8 patients)
  console.log("Seeding 8 waitlisted patients...");
  const waitlist = [
    { patientName: "Rahul Sen", age: 34, sex: "Male", emergencyContact: "Brother (+91 9876500001)", contactPhone: "+91 9876500001", symptoms: "Fever 38.8°C, dyspnea", severity: "SEVERE", priority: 1 },
    { patientName: "Amina Begum", age: 52, sex: "Female", emergencyContact: "Son (+91 9876500002)", contactPhone: "+91 9876500002", symptoms: "Persistent dry cough, fever", severity: "SEVERE", priority: 2 },
    { patientName: "Kishore Kumar", age: 41, sex: "Male", emergencyContact: "Wife (+91 9876500003)", contactPhone: "+91 9876500003", symptoms: "Fever, body ache", severity: "MODERATE", priority: 3 },
    { patientName: "Sunanda Das", age: 29, sex: "Female", emergencyContact: "Mother (+91 9876500004)", contactPhone: "+91 9876500004", symptoms: "Fatigue, mild fever", severity: "MILD", priority: 4 },
    { patientName: "Farhan Akhtar", age: 45, sex: "Male", emergencyContact: "Sister (+91 9876500005)", contactPhone: "+91 9876500005", symptoms: "Chills, sore throat", severity: "MODERATE", priority: 5 },
    { patientName: "Bimla Devi", age: 67, sex: "Female", emergencyContact: "Daughter (+91 9876500006)", contactPhone: "+91 9876500006", symptoms: "Fever, shortness of breath", severity: "SEVERE", priority: 6 },
    { patientName: "Naveen Jindal", age: 38, sex: "Male", emergencyContact: "Spouse (+91 9876500007)", contactPhone: "+91 9876500007", symptoms: "Fever 38.2°C", severity: "MODERATE", priority: 7 },
    { patientName: "Tanushree Paul", age: 24, sex: "Female", emergencyContact: "Father (+91 9876500008)", contactPhone: "+91 9876500008", symptoms: "Low-grade fever", severity: "MILD", priority: 8 },
  ];
  await prisma.waitlistEntry.createMany({ data: waitlist });

  // 9. Initial Heartbeat log
  await prisma.heartbeatLog.create({
    data: {
      status: "OK",
      responseTimeMs: 12,
      timestamp: new Date(),
      details: "Initial system self-ping heartbeat check passed.",
    },
  });

  console.log("✅ Seed completed successfully! 74 rooms, active patients, ~120 historical records, waitlist, and staff users ready.");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

