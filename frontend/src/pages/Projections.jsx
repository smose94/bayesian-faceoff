import teamColours from '../../data/teamcolours';
import nhlDivisions from '../../data/teamdivisions';
import React, { useEffect, useState, useRef } from 'react';
import { Box, Text, Grid, Flex, Heading, Progress } from '@chakra-ui/react';
import supabase from '../supabaseClient';
import * as d3 from 'd3';

export default function Projections() {
    const [data, setData] = useState([]);
    const [error, setError] = useState('');
    const [groupedData, setGroupedData] = useState({});
    const [playoffProbabilities, setPlayoffProbabilities] = useState({});
    const [teamStandings, setTeamStandings] = useState({});
    const tooltipRef = useRef(null);
    // State variables for regulation wins and clinched status
    const [regulationWins, setRegulationWins] = useState({});
    const [clinched, setClinched] = useState({});

    // Fetch both team standings and projected points data
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch the latest team standings data
                const { data: standingsData, error: standingsError } = await supabase
                    .from('team_standings')
                    .select('*')
                    .order('date', { ascending: false })
                    .limit(32);  // Get latest record for each team (32 teams)
    
                if (standingsError) {
                    console.error('Error fetching standings data:', standingsError);
                    setError(`Failed to fetch standings data: ${standingsError.message}`);
                    return;
                }
    
                // Fetch projection data
                const { data: projectionsData, error: projectionsError } = await supabase
                    .from('team_points')
                    .select('*')
                    .order('id', { ascending: false })
                    .limit(32);
    
                if (projectionsError) {
                    console.error('Error fetching projections data:', projectionsError);
                    setError(`Failed to fetch projections data: ${projectionsError.message}`);
                    return;
                }
    
                // Process everything in sequence to avoid race conditions
                if (standingsData.length > 0 && projectionsData.length > 0) {
                    // 1. Process standings data first
                    const standingsMap = {};
                    const regWinsMap = {};
                    
                    standingsData.forEach(team => {
                        standingsMap[team.team_name] = {
                            wins: team.wins,
                            losses: team.losses,
                            ot: team.ot,
                            points: team.points,
                            regulationWins: team.regulation_wins,
                            gamesPlayed: team.wins + team.losses + team.ot,
                            gamesRemaining: 82 - (team.wins + team.losses + team.ot)
                        };
                        
                        regWinsMap[team.team_name] = team.regulation_wins || 0;
                    });
                    
                    // 2. Determine clinched teams
                    const clinchStatus = calculateClinched(standingsData);
                    
                    // 3. Process projection data
                    const sortedData = projectionsData.map(item => ({
                        ...item,
                        points: JSON.parse(item.points.replace(/'/g, '"')),
                        meanPoints: d3.mean(JSON.parse(item.points.replace(/'/g, '"'))),
                        division: nhlDivisions[item.team],
                        // Add current standings
                        currentRecord: standingsMap[item.team] || null
                    })).sort((a, b) => a.team.localeCompare(b.team));
    
                    // Group data by division
                    const divisionGroups = sortedData.reduce((acc, item) => {
                        acc[item.division] = acc[item.division] || [];
                        acc[item.division].push(item);
                        return acc;
                    }, {});
    
                    const divisionOrder = ['Atlantic', 'Metropolitan', 'Central', 'Pacific'];
                    const orderedData = divisionOrder.reduce((acc, division) => {
                        if (divisionGroups[division]) {
                            acc[division] = divisionGroups[division];
                        }
                        return acc;
                    }, {});
    
                    // 4. Calculate playoff probabilities
                    const probabilities = calculatePlayoffProbabilities(divisionGroups, standingsMap, clinchStatus);
                    
                    // 5. Update all states at once
                    setTeamStandings(standingsMap);
                    setRegulationWins(regWinsMap);
                    setClinched(clinchStatus);
                    setGroupedData(orderedData);
                    setPlayoffProbabilities(probabilities);
                } else {
                    setError('No data available.');
                }
            } catch (err) {
                console.error('Error in data fetching:', err);
                setError(`An error occurred: ${err.message}`);
            }
        };
    
        fetchData();
    }, []); // Empty dependency array to run only on mount

// Function to determine which teams have clinched
function calculateClinched(teamsData) {
    const clinchStatus = {};
    
    // Convert raw data to the format we need
    const processedTeamsData = teamsData.map(team => ({
        team: team.team_name,
        points: team.points,
        regulation_wins: team.regulation_wins,
        games_played: team.wins + team.losses + team.ot,
        games_remaining: 82 - (team.wins + team.losses + team.ot),
        max_possible_points: team.points + (2 * (82 - (team.wins + team.losses + team.ot))) // Current points + 2 points for each remaining game
    }));
    
    // Group teams by division and conference
    const divisionTeams = {};
    const conferenceTeams = { 'Eastern': [], 'Western': [] };
    
    processedTeamsData.forEach(team => {
        const division = nhlDivisions[team.team];
        const conference = ['Atlantic', 'Metropolitan'].includes(division) ? 'Eastern' : 'Western';
        
        // Add to division grouping
        if (!divisionTeams[division]) divisionTeams[division] = [];
        divisionTeams[division].push(team);
        
        // Add to conference grouping
        conferenceTeams[conference].push(team);
    });
    
    // Calculate division clinch status
    Object.entries(divisionTeams).forEach(([division, teams]) => {
        // Sort teams by points (descending)
        const sortedTeams = [...teams].sort((a, b) => {
            // First by points
            if (b.points !== a.points) return b.points - a.points;
            // Then by regulation wins (tiebreaker)
            return b.regulation_wins - a.regulation_wins;
        });
        
        // Check for top 3 in division clinch
        for (let i = 0; i < Math.min(3, sortedTeams.length); i++) {
            const team = sortedTeams[i];
            
            // Get 4th place team and below
            const teamsBelowCutoff = sortedTeams.slice(3);
            
            // If no teams below cutoff, this team has clinched
            if (teamsBelowCutoff.length === 0) {
                clinchStatus[team.team] = 'division';
                continue;
            }
            
            // Check if this team has clinched over all teams below the cutoff
            const hasClinched = teamsBelowCutoff.every(otherTeam => {
                // Maximum points the other team can achieve
                return otherTeam.max_possible_points < team.points;
            });
            
            if (hasClinched) {
                clinchStatus[team.team] = 'division';
            }
        }
    });
    
    // Calculate wildcard clinch status
    Object.entries(conferenceTeams).forEach(([conference, allTeams]) => {
        // Group by division to identify top 3 in each division
        const divisionTopTeams = {};
        
        // Find teams that have clinched division and top 3 in each division
        Object.entries(divisionTeams)
            .filter(([div]) => (conference === 'Eastern' && ['Atlantic', 'Metropolitan'].includes(div)) || 
                               (conference === 'Western' && ['Central', 'Pacific'].includes(div)))
            .forEach(([div, teams]) => {
                // Sort teams in this division
                const sortedDivTeams = [...teams].sort((a, b) => {
                    if (b.points !== a.points) return b.points - a.points;
                    return b.regulation_wins - a.regulation_wins;
                });
                
                // Get top 3 teams in division (or those that clinched division)
                divisionTopTeams[div] = sortedDivTeams
                    .filter((team, i) => i < 3 || clinchStatus[team.team] === 'division')
                    .map(team => team.team);
            });
        
        // Flatten all division top teams
        const allDivisionTopTeams = Object.values(divisionTopTeams).flat();
        
        // Get remaining teams for wildcard race
        const wildcardContenders = allTeams.filter(team => 
            !allDivisionTopTeams.includes(team.team));
            
        // Sort wildcard contenders by points
        const sortedWildcardContenders = [...wildcardContenders].sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            return b.regulation_wins - a.regulation_wins;
        });
        
        // Check for wildcard clinch (top 2 wildcards)
        for (let i = 0; i < Math.min(2, sortedWildcardContenders.length); i++) {
            const team = sortedWildcardContenders[i];
            
            // Get teams below wildcard cutoff (3rd place and lower in wildcard race)
            const teamsBelowCutoff = sortedWildcardContenders.slice(2);
            
            // If no teams below cutoff, this team has clinched
            if (teamsBelowCutoff.length === 0) {
                // Only set if not already clinched division
                if (!clinchStatus[team.team]) {
                    clinchStatus[team.team] = 'wildcard';
                }
                continue;
            }
            
            // Check if this team has clinched over all teams below the cutoff
            const hasClinched = teamsBelowCutoff.every(otherTeam => {
                // Maximum points the other team can achieve
                return otherTeam.max_possible_points < team.points;
            });
            
            if (hasClinched && !clinchStatus[team.team]) {
                clinchStatus[team.team] = 'wildcard';
            }
        }
    });
    
    return clinchStatus;
}

    // Helper function to determine conference based on division
    const getConference = (division) => {
        return ['Atlantic', 'Metropolitan'].includes(division) ? 'Eastern' : 'Western';
    };

    const calculateDivisionThreshold = (division) => {
        if (!groupedData[division]) return null;
        
        // Get teams in the division
        const teams = groupedData[division];
        
        // Calculate average points for fourth place in each simulation
        const simCount = teams[0].points.length;
        let sumThreshold = 0;
        let validSims = 0;
        
        for (let i = 0; i < simCount; i++) {
            // Get points for this simulation
            const simPoints = teams.map(team => ({
                team: team.team,
                points: team.points[i]
            }));
            
            // Sort by points (highest first)
            const sorted = simPoints.sort((a, b) => b.points - a.points);
            
            // If we have at least 4 teams, get points of 4th place (threshold for top 3)
            if (sorted.length >= 4) {
                sumThreshold += sorted[3].points;
                validSims++;
            }
        }
        
        // Return average threshold
        return validSims > 0 ? sumThreshold / validSims : null;
    };
    
    // Calculate the typical wildcard threshold
    const calculateWildcardThreshold = (conference) => {
        // Get divisions in this conference
        const conferenceDivisions = Object.entries(groupedData)
            .filter(([division]) => getConference(division) === conference)
            .map(([division]) => division);
            
        if (conferenceDivisions.length === 0) return null;
        
        // Combine all teams from this conference
        const conferenceTeams = conferenceDivisions.flatMap(division => 
            groupedData[division] || []);
            
        // Calculate average points for wildcard cutoff in each simulation
        const simCount = conferenceTeams[0]?.points.length || 0;
        if (simCount === 0) return null;
        
        let sumThreshold = 0;
        let validSims = 0;
        
        for (let i = 0; i < simCount; i++) {
            // For each simulation
            const teamsWithPoints = conferenceTeams.map(team => ({
                team: team.team,
                points: team.points[i],
                division: nhlDivisions[team.team]
            }));
            
            // Group by division
            const divisionGroups = teamsWithPoints.reduce((acc, team) => {
                acc[team.division] = acc[team.division] || [];
                acc[team.division].push(team);
                return acc;
            }, {});
            
            // Get teams that made top 3 in each division
            const divisionQualifiers = [];
            for (const [div, divTeams] of Object.entries(divisionGroups)) {
                const topThree = [...divTeams]
                    .sort((a, b) => b.points - a.points)
                    .slice(0, 3);
                    
                divisionQualifiers.push(...topThree);
            }
            
            // Remove division qualifiers and sort remaining teams
            const wildcardContenders = teamsWithPoints
                .filter(team => !divisionQualifiers.some(t => t.team === team.team))
                .sort((a, b) => b.points - a.points);
                
            // If we have enough teams, get points of the last wildcard (2nd wildcard spot)
            if (wildcardContenders.length >= 2) {
                sumThreshold += wildcardContenders[1].points;
                validSims++;
            }
        }
        
        // Return average threshold
        return validSims > 0 ? sumThreshold / validSims : null;
    };

// Updated calculatePlayoffProbabilities function with standings data integration
// Updated function that takes clinched status as a parameter instead of using state
const calculatePlayoffProbabilities = (divisionGroups, teamStandingsData, clinchStatusData) => {
    // Create a deep copy to avoid mutating the original data
    const simulationData = JSON.parse(JSON.stringify(divisionGroups));
    
    // Group teams by conference
    const conferenceGroups = {
        'Eastern': [],
        'Western': []
    };
    
    // Track playoff appearance counts for each team
    const playoffCounts = {};
    const totalSimulations = Object.values(divisionGroups)[0][0].points.length;
    
    // Log team standings data with regulation wins info
    console.log("Team standings with regulation wins (used for tiebreakers):", 
        Object.entries(teamStandingsData).reduce((acc, [team, data]) => {
            acc[team] = {
                points: data.points,
                regulationWins: data.regulationWins
            };
            return acc;
        }, {})
    );
    
    console.log("Clinched status:", clinchStatusData);
    
    // Initialize playoff counts for all teams
    Object.values(divisionGroups).flat().forEach(team => {
        // Check if team has already clinched
        if (clinchStatusData[team.team]) {
            // If team has clinched, set probability to 100%
            playoffCounts[team.team] = {
                divisionTop3: clinchStatusData[team.team] === 'division' ? totalSimulations : 0,
                wildcard: clinchStatusData[team.team] === 'wildcard' ? totalSimulations : 0,
                total: totalSimulations // 100% probability
            };
        } else {
            // If not clinched, initialize to zero
            playoffCounts[team.team] = {
                divisionTop3: 0,
                wildcard: 0,
                total: 0
            };
        }
    });
    
    // For each simulation (each index in the points array)
    for (let simIndex = 0; simIndex < totalSimulations; simIndex++) {
        // Reset conference groups for this simulation
        conferenceGroups['Eastern'] = [];
        conferenceGroups['Western'] = [];
        
        // Process each division
        for (const [division, teams] of Object.entries(simulationData)) {
            const conference = getConference(division);
            
            // Get teams with their simulated points for this simulation
            const teamsWithPoints = teams.map(team => {
                // Get standings data if available
                const currentStandings = teamStandingsData[team.team];
                
                return {
                    team: team.team,
                    points: team.points[simIndex],
                    division,
                    isClinched: clinchStatusData[team.team], // Add clinched status
                    currentPoints: currentStandings ? currentStandings.points : 0,
                    gamesPlayed: currentStandings ? currentStandings.gamesPlayed : 0,
                    gamesRemaining: currentStandings ? currentStandings.gamesRemaining : 0
                };
            });
            
            // Sort teams by points for this simulation (highest first)
            // Exclude teams that have already clinched division spots
            const sortedTeams = [...teamsWithPoints]
                .filter(team => !team.isClinched || team.isClinched !== 'division')
                .sort((a, b) => {
                    // First sort by projected points
                    if (b.points !== a.points) return b.points - a.points;
                    // If projected points are tied, use regulation wins from team_standings as tiebreaker
                    const aRegWins = teamStandingsData[a.team]?.regulationWins || 0;
                    const bRegWins = teamStandingsData[b.team]?.regulationWins || 0;
                    return bRegWins - aRegWins;
                });
            
            // Count available division spots after accounting for clinched teams
            const clinchedDivisionCount = teamsWithPoints.filter(t => 
                t.isClinched === 'division').length;
            const availableDivisionSpots = 3 - clinchedDivisionCount;
            
            // Top teams in division make playoffs (if spots are available)
            for (let i = 0; i < Math.min(availableDivisionSpots, sortedTeams.length); i++) {
                if (!clinchStatusData[sortedTeams[i].team]) {
                    playoffCounts[sortedTeams[i].team].divisionTop3++;
                    playoffCounts[sortedTeams[i].team].total++;
                }
            }
            
            // Add all teams to their conference group for wildcard calculation
            conferenceGroups[conference].push(...teamsWithPoints);
        }
        
        // Process wildcard spots for each conference
        for (const conference of ['Eastern', 'Western']) {
            // Get teams that didn't make top 3 in their division and aren't clinched
            const conferenceTeams = conferenceGroups[conference];
            
            // Group teams by division
            const conferenceDivisions = conferenceTeams.reduce((acc, team) => {
                acc[team.division] = acc[team.division] || [];
                acc[team.division].push(team);
                return acc;
            }, {});
            
            // Identify teams that already made playoffs 
            // (top 3 in division or clinched division)
            const divisionPlayoffTeams = [];
            for (const divTeams of Object.values(conferenceDivisions)) {
                // Add clinched division teams
                const clinchedTeams = divTeams
                    .filter(t => t.isClinched === 'division')
                    .map(t => t.team);
                divisionPlayoffTeams.push(...clinchedTeams);
                
                // Get teams that haven't clinched division
                const unclinchedTeams = divTeams
                    .filter(t => !t.isClinched || t.isClinched !== 'division')
                    .sort((a, b) => {
                        // First sort by projected points
                        if (b.points !== a.points) return b.points - a.points;
                        // If projected points are tied, use regulation wins from team_standings as tiebreaker
                        const aRegWins = teamStandingsData[a.team]?.regulationWins || 0;
                        const bRegWins = teamStandingsData[b.team]?.regulationWins || 0;
                        return bRegWins - aRegWins;
                    });
                
                // Count remaining spots in division
                const availableSpots = 3 - clinchedTeams.length;
                
                // Add top teams to division playoff teams
                divisionPlayoffTeams.push(
                    ...unclinchedTeams.slice(0, availableSpots).map(t => t.team)
                );
            }
            
            // Get teams that have clinched wildcard
            const clinchedWildcardTeams = conferenceTeams
                .filter(t => t.isClinched === 'wildcard')
                .map(t => t.team);
            
            // Sort remaining conference teams by points for wildcard selection
            // PROPERLY use projected points with regulation wins tiebreaker
            const sortedWildcardContenders = [...conferenceTeams]
                .filter(team => 
                    !divisionPlayoffTeams.includes(team.team) && 
                    !clinchedWildcardTeams.includes(team.team))
                .sort((a, b) => {
                    // First sort by projected points from the simulation
                    if (b.points !== a.points) return b.points - a.points;
                    
                    // If projected points are tied, use regulation wins from team_standings as tiebreaker
                    const aRegWins = teamStandingsData[a.team]?.regulationWins || 0;
                    const bRegWins = teamStandingsData[b.team]?.regulationWins || 0;
                    return bRegWins - aRegWins;
                });
            
            // Count available wildcard spots after accounting for clinched teams
            const availableWildcardSpots = 2 - clinchedWildcardTeams.length;
            
            // Top remaining teams get wildcard spots
            for (let i = 0; i < Math.min(availableWildcardSpots, sortedWildcardContenders.length); i++) {
                if (!clinchStatusData[sortedWildcardContenders[i].team]) {
                    playoffCounts[sortedWildcardContenders[i].team].wildcard++;
                    playoffCounts[sortedWildcardContenders[i].team].total++;
                }
            }
        }
    }
    
    // Convert counts to probabilities
    const probabilities = {};
    for (const [team, counts] of Object.entries(playoffCounts)) {
        probabilities[team] = {
            divisionTop3: counts.divisionTop3 / totalSimulations,
            wildcard: counts.wildcard / totalSimulations,
            total: counts.total / totalSimulations
        };
    }
    
    return probabilities;
};
    // Visualization functions
    const drawHistogram = (svgRef, points, teamColour, teamName) => {
        const svg = d3.select(svgRef);
        svg.selectAll("*").remove(); // Clear any existing SVG elements

        const margin = { top: 5, right: 5, bottom: 5, left: 20 };
        const width = 250 - margin.left - margin.right;
        const height = 130 - margin.top - margin.bottom;

        const x = d3.scaleLinear()
            .domain([d3.min(points) - 3, d3.max(points) + 3])
            .range([0, width]);

        const histogram = d3.bin()
            .value(d => d)
            .domain(x.domain())
            .thresholds(x.ticks(10));

        const bins = histogram(points);

        const y = d3.scaleLinear()
            .domain([0, d3.max(bins, d => d.length)])
            .range([height, 0]);

        const chart = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        chart.append("g").call(d3.axisLeft(y)).style("display", "none");
        chart.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x)).selectAll("text").style("display", "none");
        
        // Draw the histogram bars
        chart.selectAll("rect")
            .data(bins)
            .enter()
            .append("rect")
            .attr("x", 1)
            .attr("transform", d => `translate(${x(d.x0)},${y(d.length)})`)
            .attr("width", d => x(d.x1) - x(d.x0))
            .attr("height", d => height - y(d.length))
            .style("fill", teamColour)
            .on("mouseover", (event, d) => {
                // Show team record on histogram hover
                const currentRecord = teamStandings[teamName];
                if (currentRecord) {
                    d3.select(tooltipRef.current)
                        .style("visibility", "visible")
                        .html(`
                            <div style="font-weight: bold;">${teamName}</div>
                            <div>Current Record: ${currentRecord.wins}-${currentRecord.losses}-${currentRecord.ot}</div>
                            <div>Current Points: ${currentRecord.points}</div>
                            <div>Regulation Wins: ${currentRecord.regulationWins}</div>
                            <div>Games Played: ${currentRecord.gamesPlayed}</div>
                            <div>Games Remaining: ${currentRecord.gamesRemaining}</div>
                            <div>Point Range: ${d.x0.toFixed(0)}-${d.x1.toFixed(0)}</div>
                            <div>Frequency: ${d.length} simulations</div>
                        `);
                }
            })
            .on("mousemove", (event) => {
                d3.select(tooltipRef.current)
                    .style("top", `${event.pageY - 100}px`)
                    .style("left", `${event.pageX - 200}px`);
            })
            .on("mouseout", () => {
                d3.select(tooltipRef.current).style("visibility", "hidden");
            });
    };

    const drawBarChart = (svgRef, teams, division) => {
        const svg = d3.select(svgRef);
        svg.selectAll("*").remove(); // Clear any existing SVG elements

        const margin = { top: 30, right: 60, bottom: 30, left: 120 };
        const width = 400 - margin.left - margin.right;
        const height = 200 - margin.top - margin.bottom;

        // Sort teams by mean points for the visualization
        const sortedTeams = [...teams].sort((a, b) => b.meanPoints - a.meanPoints);
        
        // Get playoff cutoff values based on simulation data
        const divisionThreshold = calculateDivisionThreshold(division);
        const wildcardThreshold = calculateWildcardThreshold(getConference(division));

        const x = d3.scaleLinear()
            .domain([0, d3.max(teams, d => d.meanPoints) * 1.05]) // Add some padding
            .range([0, width]);

        const y = d3.scaleBand()
            .domain(sortedTeams.map(d => d.team))
            .range([0, height])
            .padding(0.1);

        const chart = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // Add x-axis label
        chart.append("text")
            .attr("text-anchor", "middle")
            .attr("x", width / 2)
            .attr("y", height + margin.bottom - 5)
            .text("Projected Points")
            .style("font-size", "12px");

        chart.append("g").call(d3.axisLeft(y));
        chart.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x));

        // Add bars for each team
        const bars = chart.selectAll(".bar").data(sortedTeams).enter().append("rect")
            .attr("class", "bar")
            .attr("y", d => y(d.team))
            .attr("height", y.bandwidth())
            .attr("x", 0)
            .attr("width", d => x(d.meanPoints))
            .attr("fill", d => {
                const probability = playoffProbabilities[d.team] || { total: 0 };
                // Color bars based on playoff probability
                if (probability.total > 0.8) return teamColours[d.team];
                return d3.color(teamColours[d.team]).darker(probability.total < 0.4 ? 1.5 : 0.5);
            })
            .attr("stroke", d => {
                const probability = playoffProbabilities[d.team] || { total: 0 };
                return probability.total > 0.5 ? "black" : "none";
            })
            .attr("stroke-width", d => {
                const probability = playoffProbabilities[d.team] || { total: 0 };
                return probability.total > 0.5 ? 1 : 0;
            });

        // Add current points markers as vertical lines on the bars
        chart.selectAll(".current-points")
            .data(sortedTeams)
            .enter()
            .append("line")
            .attr("class", "current-points")
            .attr("x1", d => {
                const current = teamStandings[d.team];
                return current ? x(current.points) : 0;
            })
            .attr("y1", d => y(d.team))
            .attr("x2", d => {
                const current = teamStandings[d.team];
                return current ? x(current.points) : 0;
            })
            .attr("y2", d => y(d.team) + y.bandwidth())
            .attr("stroke", "black")
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "4")
            .style("display", d => teamStandings[d.team] ? "block" : "none");

        // Add playoff probability markers at the end of each bar
        chart.selectAll(".playoff-marker")
            .data(sortedTeams)
            .enter()
            .append("text")
            .attr("class", "playoff-marker")
            .attr("x", d => x(d.meanPoints) + 5)
            .attr("y", d => y(d.team) + y.bandwidth() / 2)
            .attr("dominant-baseline", "middle")
            .text(d => {
                const probability = playoffProbabilities[d.team] || { total: 0 };
                return `${(probability.total * 100).toFixed(0)}%`;
            })
            .style("font-size", "10px")
            .style("font-weight", "bold")
            .style("fill", d => {
                const probability = playoffProbabilities[d.team] || { total: 0 };
                return probability.total > 0.5 ? "green" : probability.total > 0.2 ? "orange" : "red";
            });

        // Enhanced tooltip with current record information
        bars.on("mouseover", (event, d) => {
            const probability = playoffProbabilities[d.team] || { total: 0, divisionTop3: 0, wildcard: 0 };
            const currentRecord = teamStandings[d.team];
            
            let tooltipContent = `
                <div style="font-weight: bold;">${d.team}</div>
                <div>Projected points: ${d.meanPoints.toFixed(1)}</div>
                <div>Playoff probability: ${(probability.total * 100).toFixed(1)}%</div>
                <div>- Division (Top 3): ${(probability.divisionTop3 * 100).toFixed(1)}%</div>
                <div>- Wildcard: ${(probability.wildcard * 100).toFixed(1)}%</div>
            `;
            
            // Add current record if available
            if (currentRecord) {
                tooltipContent += `
                    <div style="margin-top: 8px; border-top: 1px solid #ccc; padding-top: 5px;">
                    <div>Current Record: ${currentRecord.wins}-${currentRecord.losses}-${currentRecord.ot}</div>
                    <div>Current Points: ${currentRecord.points}</div>
                    <div>Regulation Wins: ${currentRecord.regulationWins}</div>
                    <div>Games Played: ${currentRecord.gamesPlayed}</div>
                    <div>Games Remaining: ${currentRecord.gamesRemaining}</div>
                    </div>
                `;
            }
            
            d3.select(tooltipRef.current)
                .style("visibility", "visible")
                .html(tooltipContent);
        })
        .on("mousemove", (event) => {
            d3.select(tooltipRef.current)
                .style("top", `${event.pageY - 100}px`)
                .style("left", `${event.pageX - 200}px`);
        })
        .on("mouseout", () => {
            d3.select(tooltipRef.current).style("visibility", "hidden");
        });
    };

    return (
        <Box p={5} position="relative">
            {error && <Text color="red.500">{error}</Text>}
            <Heading size="xl" mb={5} textAlign="center">Point projections and playoff odds</Heading>
            
            <Grid templateColumns="repeat(2, 1fr)" gap={4} mb={10}>
                {Object.entries(groupedData).slice(0, 2).map(([division, teams]) => (
                    <Box key={division} p={4} display="flex" flexDirection="column" justifyContent="center" alignItems="center" boxShadow="0px 4px 6px rgba(0, 0, 0, 0.1)" borderRadius="lg" borderWidth="1px" borderColor="gray.200" height="320px">
                        <Heading size="md" mb={2}>{division}</Heading>
                        <svg ref={el => {
                            if (el) drawBarChart(el, teams, division);
                        }} width="400" height="300" />
                    </Box>
                ))}
            </Grid>
            <Grid templateColumns="repeat(2, 1fr)" gap={4} mb={10}>
                {Object.entries(groupedData).slice(2, 4).map(([division, teams]) => (
                    <Box key={division} p={4} display="flex" flexDirection="column" justifyContent="center" alignItems="center" boxShadow="0px 4px 6px rgba(0, 0, 0, 0.1)" borderRadius="lg" borderWidth="1px" borderColor="gray.200" height="320px">
                        <Heading size="md" mb={2}>{division}</Heading>
                        <svg ref={el => {
                            if (el) drawBarChart(el, teams, division);
                        }} width="400" height="300" />
                    </Box>
                ))}
            </Grid>
            
            {Object.entries(groupedData).map(([division, teams]) => (
                <Box key={division} mb={10}>
                    <Heading size="lg" mb={5}>{division} Division</Heading>
                    <Grid 
                        templateColumns={{ 
                            base: "repeat(1, 1fr)", 
                            md: "repeat(2, 1fr)", 
                            lg: "repeat(4, 1fr)" 
                        }} 
                        gap={4}>
                    {teams.sort((a, b) => a.team.localeCompare(b.team)).map((teamData, index) => {
                        const probability = playoffProbabilities[teamData.team] || { total: 0 };
                        const playoffPercentage = (probability.total * 100).toFixed(0);
                        const currentRecord = teamStandings[teamData.team];
                        
                        return (
                            <Box 
                                key={index} 
                                p={3} 
                                boxShadow="0px 4px 6px rgba(0, 0, 0, 0.1)" 
                                borderRadius="lg" 
                                borderWidth="1px" 
                                borderColor="gray.200"
                                height="auto" // Change from fixed height to auto
                                minHeight="280px" // Add minimum height to ensure consistency
                                display="flex"
                                flexDirection="column"
                            >
                                <Flex direction="column" align="center" justify="center" mb={2}>
                                    <Text fontSize="lg" fontWeight="bold" textAlign="center" color={teamColours[teamData.team]}>
                                        {teamData.team}
                                    </Text>
                                    {currentRecord && (
                                        <Text fontSize="sm" textAlign="center">
                                            {currentRecord.wins}-{currentRecord.losses}-{currentRecord.ot} ({currentRecord.points} pts)
                                        </Text>
                                    )}
                                    <Text fontSize="md" textAlign="center">Mean Points: {teamData.meanPoints.toFixed(0)}</Text>
                                    <Text 
                                        fontSize="md" 
                                        textAlign="center" 
                                        fontWeight={playoffPercentage > 50 ? "bold" : "normal"}
                                        mb={2} // Add bottom margin for spacing
                                    >
                                        Playoff Odds: {playoffPercentage}%
                                    </Text>
                                </Flex>
                                
                                <Progress 
                                    value={probability.total * 100} 
                                    colorScheme={playoffPercentage > 80 ? "green" : playoffPercentage > 50 ? "blue" : playoffPercentage > 20 ? "yellow" : "red"}
                                    height="8px"
                                    borderRadius="full"
                                    mb={2}
                                />
                                
                                <Flex justify="space-between" fontSize="xs" color="gray.600" mb={2}>
                                    <Text>Division: {(probability.divisionTop3 * 100).toFixed(0)}%</Text>
                                    <Text>Wildcard: {(probability.wildcard * 100).toFixed(0)}%</Text>
                                </Flex>
                                
                                <Box mt="auto"> {/* Push histogram to bottom of card */}
                                    <svg ref={el => {
                                        if (el) drawHistogram(el, teamData.points, teamColours[teamData.team], teamData.team);
                                    }} width="250" height="150" />
                                </Box>
                            </Box>
                        );
                    })}
                    </Grid>
                </Box>
            ))}
            
            <div
                ref={tooltipRef}
                style={{
                    position: 'absolute',
                    visibility: 'hidden',
                    backgroundColor: 'white',
                    border: 'solid 1px black',
                    padding: '8px',
                    borderRadius: '4px',
                    pointerEvents: 'none',
                    boxShadow: '0px 2px 5px rgba(0, 0, 0, 0.2)',
                    fontSize: '14px',
                    lineHeight: '1.4',
                    maxWidth: '300px',
                    zIndex: 1000
                }}
            />
        </Box>
    );
}