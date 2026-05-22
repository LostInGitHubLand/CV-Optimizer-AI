export const baseProfile = {
  name: "Alex Rossi",
  title: "Data Analyst",
  contact: { email: "alex@example.com", location: "Rome, Italy", linkedin: "https://linkedin.com/in/alexrossi", additionalLinks: [{ label: "GitHub", url: "https://github.com/alex" }] },
  summary: "Data analyst with experience in dashboards, reporting and stakeholder communication.",
  experience: [
    { role: "Junior Data Analyst", company: "Acme Analytics", location: "Rome", startDate: "2022", endDate: "Present", description: "Built dashboards and supported reporting workflows.", achievements: ["Built weekly dashboards", "Coordinated reporting with sales team"] },
    { role: "Basketball Coach", company: "Local Sports Club", location: "Rome", startDate: "2020", endDate: "2021", description: "Coached youth team and planned training sessions.", achievements: ["Planned training drills", "Mentored junior players"] },
  ],
  education: [{ degree: "BSc Statistics", institution: "University of Rome", field: "Statistics", startDate: "2018", year: "2021", grade: "110/110", details: "Thesis on predictive models" }],
  skills: { technical: ["Python", "SQL", "Power BI"], soft: ["Communication", "Stakeholder Management"], languages: ["Italian (Native)", "English (Professional)"], tools: ["Git", "Excel"] },
  certifications: [{ name: "Google Data Analytics Certificate", issuer: "Google", year: "2023", description: "Data analytics foundations" }],
  projects: [{ name: "Sales Dashboard", description: "Built a dashboard for sales reporting", technologies: ["Power BI", "SQL"] }],
  awards: ["Finalist — Regional Data Challenge 2021"],
  publications: [],
  volunteer: ["Volunteer coach for youth basketball"],
  interests: ["Basketball", "Data visualization"],
} as const;

export const baseJobAdvert = `We are hiring a Data Analyst with Python, SQL, dashboarding, stakeholder communication, reporting and business intelligence experience.`;
