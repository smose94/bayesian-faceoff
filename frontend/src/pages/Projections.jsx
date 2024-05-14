import teamColours from '../../data/teamcolours';
import nhlDivisions from '../../data/teamdivisions';
import React, { useEffect, useState } from 'react';
import { Box, Text, Grid, Flex, Heading } from '@chakra-ui/react';
import supabase from '../supabaseClient';
import * as d3 from 'd3';

export default function Projections() {
    const [data, setData] = useState([]);
    const [error, setError] = useState('');
    const [groupedData, setGroupedData] = useState({});

    useEffect(() => {
        const fetchData = async () => {
            const { data: fetchedData, error } = await supabase
                .from('team_points')
                .select('*')
                .order('id', { ascending: false })  // Fetch the last 32 records
                .limit(32);

            if (error) {
                console.error('Error fetching data:', error);
                setError(`Failed to fetch data: ${error.message}`);
                return;
            }

            if (fetchedData.length > 0) {
                // Sort data by team name within each division
                const sortedData = fetchedData.map(item => ({
                    ...item,
                    points: JSON.parse(item.points.replace(/'/g, '"')),
                    meanPoints: d3.mean(JSON.parse(item.points.replace(/'/g, '"'))),
                    division: nhlDivisions[item.team]
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

                setGroupedData(orderedData);
            } else {
                setError('No data available.');
            }
        };

        fetchData();
    }, []);

    const drawHistogram = (svgRef, points, teamColour) => {
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
        chart.selectAll("rect").data(bins).enter().append("rect").attr("x", 1).attr("transform", d => `translate(${x(d.x0)},${y(d.length)})`).attr("width", d => x(d.x1) - x(d.x0)).attr("height", d => height - y(d.length)).style("fill", teamColour);
    };

    const drawBarChart = (svgRef, teams) => {
        const svg = d3.select(svgRef);
        svg.selectAll("*").remove(); // Clear any existing SVG elements

        const margin = { top: 0, right: 10, bottom: 0, left: 120 };
        const width = 400 - margin.left - margin.right;
        const height = 200 - margin.top //- margin.bottom;

        const x = d3.scaleLinear()
            .domain([0, d3.max(teams, d => d.meanPoints)])
            .range([0, width]);

        const y = d3.scaleBand()
            .domain(teams.map(d => d.team))
            .range([0, height])
            .padding(0.1);

        const chart = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        chart.append("g").call(d3.axisLeft(y));
        chart.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x));

        chart.selectAll(".bar").data(teams).enter().append("rect")
            .attr("class", "bar")
            .attr("y", d => y(d.team))
            .attr("height", y.bandwidth())
            .attr("x", 0)
            .attr("width", d => x(d.meanPoints))
            .attr("fill", d => teamColours[d.team]);
    };

    return (
        <Box p={5}>
            {error && <Text color="red.500">{error}</Text>}
            <Grid templateColumns="repeat(2, 1fr)" gap={4} mb={10}>
                {Object.entries(groupedData).slice(0, 2).map(([division, teams]) => (
                    <Box Box key={division} p={2} display="flex" flexDirection="column" justifyContent="center" alignItems="center" boxShadow="0px 4px 6px rgba(0, 0, 0, 0.1)" borderRadius="lg" borderWidth="1px" borderColor="gray.200" height="300px">
                        <Heading size="md" mb={2}>{division}</Heading>
                        <svg ref={el => {
                            if (el) drawBarChart(el, teams.sort((a, b) => b.meanPoints - a.meanPoints));
                        }} width="400" height="300" />
                    </Box>
                ))}
            </Grid>
            <Grid templateColumns="repeat(2, 1fr)" gap={4} mb={10}>
                {Object.entries(groupedData).slice(2, 4).map(([division, teams]) => (
                    <Box Box key={division} p={2} display="flex" flexDirection="column" justifyContent="center" alignItems="center" boxShadow="0px 4px 6px rgba(0, 0, 0, 0.1)" borderRadius="lg" borderWidth="1px" borderColor="gray.200" height="300px">
                        <Heading size="md" mb={2}>{division}</Heading>
                        <svg ref={el => {
                            if (el) drawBarChart(el, teams.sort((a, b) => b.meanPoints - a.meanPoints));
                        }} width="400" height="300" />
                    </Box>
                ))}
            </Grid>
            {Object.entries(groupedData).map(([division, teams]) => (
                <Box key={division}>
                    <Heading size="lg" mb={5}>{division} Division</Heading>
                    <Grid templateColumns="repeat(4, 1fr)" gap={4}>
                        {teams.map((teamData, index) => (
                            <Box key={index} p={2} boxShadow="0px 4px 6px rgba(0, 0, 0, 0.1)" borderRadius="lg" borderWidth="1px" borderColor="gray.200">
                                <Flex direction="column" align="center" justify="center" height="60px">
                                    <Text fontSize="lg" fontWeight="bold" textAlign="center" color={teamColours[teamData.team]}>
                                        {teamData.team}</Text>
                                    <Text fontSize="md" textAlign="center">Mean Points: {teamData.meanPoints.toFixed(0)}</Text>
                                </Flex>
                                <svg ref={el => {
                                    if (el) drawHistogram(el, teamData.points, teamColours[teamData.team]);
                                }} width="250" height="150" />
                            </Box>
                        ))}
                    </Grid>
                </Box>
            ))}
        </Box>
    );
}
