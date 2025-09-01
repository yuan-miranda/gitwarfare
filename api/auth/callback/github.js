// api/auth/callback/github.js
import axios from "axios";

const CLIENT_ID = "Ov23lisLkkAeYQ3SQ1RQ";
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

export default async function handler(req, res) {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: "Code is required" });

    try {
        // exchange code for access token
        const tokenResponse = await axios.post(
            "https://github.com/login/oauth/access_token",
            { client_id: CLIENT_ID, client_secret: CLIENT_SECRET, code },
            { headers: { Accept: "application/json" } }
        )

        const accessToken = tokenResponse.data.access_token;
        if (!accessToken) return res.status(401).json({ error: "Unauthorized" });

        // verify ownership
        const userResponse = await axios.get("https://api.github.com/user", {
            headers: { Authorization: `token ${accessToken}` },
        });

        const { login } = userResponse.data;

        const graphQLQuery = `
        query {
            user(login: "${login}") {
            contributionsCollection {
                contributionCalendar {
                weeks {
                    contributionDays {
                    date
                    contributionCount
                    }
                }
                }
            }
            }
        }`;

        const graphQLResponse = await axios.post(
            "https://api.github.com/graphql",
            { query: graphQLQuery },
            { headers: { Authorization: `bearer ${accessToken}` } }
        );

        const weeks = graphQLResponse.data.data.user.contributionsCollection.contributionCalendar.weeks;

        const contributionsByDay = weeks
            .flatMap(week => week.contributionDays)
            .filter(day => day.contributionCount > 0);

        const contributionsByYear = {};

        contributionsByDay.forEach(day => {
            const [year, month, date] = day.date.split("-");
            if (!contributionsByYear[year]) contributionsByYear[year] = {};
            if (!contributionsByYear[year][month]) contributionsByYear[year][month] = {};
            contributionsByYear[year][month][date] = day.contributionCount;
        });

        res.status(200).json({
            username: login,
            contributions: contributionsByYear
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}