import React, { useEffect, useState, useRef } from 'react';
import { Box, Flex, Heading } from '@chakra-ui/react';
import supabase from '../supabaseClient';
import teamColours from '../../data/teamcolours'; 
import teamAbbr from '../../data/teamabbreviations';
import * as d3 from 'd3';



export default function Performance() {
  const [data, setData] = useState([]);
  const svgRef = useRef(null);
  const [dimensions, setDimensions] = useState({width: 500, height: 300});
  
  const [tooltipData, setTooltipData] = useState(null);
  const [tooltipVisibility, setTooltipVisibility] = useState('hidden');
  const [tooltipPosition, setTooltipPosition] = useState({ left: 0, top: 0 });


  useEffect(() => {
    const fetchData = async () => {
      let { data: fetchedData, error } = await supabase
        .from('team_strengths')
        .select('*')
        .order('Date', { ascending: false })
        .limit(32);

      if (error) {
        console.error('error', error);
        return;
      }

      // Adjusted: Prepare data correctly and set it
      const preparedData = fetchedData.map(item => ({
        x: parseFloat(item['Mean Attack Rating'].toFixed(5)), // Ensure numerical value
        y: parseFloat(item['Mean Defense Rating'].toFixed(5)), // Ensure numerical value
        team: item['Team'],
        date: item['Date']
      }));

      setData(preparedData); // Use preparedData
    };

    fetchData();
  }, []);

  useEffect(() => {
    const resizeObserver = new ResizeObserver(entries => {
      if (entries.length === 0 || !entries[0].target) return;
      const { width } = entries[0].contentRect;
      const height = width * 0.4; // Maintain aspect ratio
      setDimensions({ width, height });
    });

    if (svgRef.current && svgRef.current.parentElement) {
      resizeObserver.observe(svgRef.current.parentElement);
    }

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    // 
    if (data.length > 0 && dimensions.width && dimensions.height) {
      const margin = { top: 20, right: 20, bottom: 30, left: 30 };
      const plottingWidth = dimensions.width - margin.left - margin.right;
      const plottingHeight = dimensions.height - margin.top - margin.bottom;
  
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove(); // Clear SVG to prevent duplicate drawing
  
      // Adjusting scales to fit data
      const xScale = d3.scaleLinear()
        .domain([d3.min(data, d => d.x) * 1.1, d3.max(data, d => d.x) * 1.1]) // Slightly extending the domain
        .range([0, plottingWidth]);
  
      const yScale = d3.scaleLinear()
        .domain([d3.min(data, d => d.y) * 1.1, d3.max(data, d => d.y) * 1.1])
        .range([0,plottingHeight]);
  
      // Transform the group for correct positioning
      const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  
    // Append x-axis without tick marks but with a label
    g.append("g")
      .attr("transform", `translate(0, ${plottingHeight})`)
      .call(d3.axisBottom(xScale).tickSize(0).tickFormat(""))
      .append("text")
      .attr("class", "axis-label")
      .attr("y", 15) // Adjust y-position to avoid overlapping with the axis line
      .attr("x", plottingWidth / 2) // Center the text
      .attr("fill", "#000")
      .style("font-size", "16px") // Change the text size 
      .style("font-family", "Arial, sans-serif") // Change the font 
      .style("text-anchor", "middle")
      .text("Offensive Strength");

      g.append("text")       
      .attr("y", plottingHeight + margin.bottom/2)
      .attr("x", 10)
      .style("text-anchor", "starts")
      .text("Weaker")
      .style("font-family", "Arial, sans-serif")
      .style("font-size", "12px");
  
    g.append("text")       
      .attr("y", plottingHeight + margin.bottom/2)
      .attr("x", plottingWidth - margin.right)
      .style("text-anchor", "end")
      .text("Stronger")
      .style("font-family", "Arial, sans-serif")
      .style("font-size", "12px");
  
    // Append y-axis without tick marks but with a label
    g.append("g")
      .call(d3.axisLeft(yScale).tickSize(0).tickFormat(""))
      .append("text")
      .attr("class", "axis-label")
      .attr("transform", "rotate(-90)")
      .attr("y", -5) // Adjust y-position for the rotated label
      .attr("x", -plottingHeight / 2) // Center the text
      .attr("fill", "#000")
      .style("font-size", "16px") // Change the text size 
      .style("font-family", "Arial, sans-serif") // Change the font
      .style("text-anchor", "middle")
      .text("Defensive Strength");

      //append 'Stronger label to y-axis
      g.append("text")       
      .attr("transform", "rotate(-90)")
      .attr("y", -5)
      .attr("x", 0 - margin.top)
      .style("text-anchor", "end")
      .text("Stronger")
      .style("font-family", "Arial, sans-serif")
      .style("font-size", "12px");

      //append Weaker label to y-axis
      g.append("text")       
      .attr("transform", "rotate(-90)")
      .attr("y", -5)
      .attr("x", 0 - (plottingHeight - margin.bottom*2))
      .style("text-anchor", "end")
      .text("Weaker")
      .style("font-family", "Arial, sans-serif")
      .style("font-size", "12px");
  
      // Plot data points
      g.selectAll("circle")
        .data(data)
        .enter()
        .append("circle")
        .attr("cx", d => xScale(d.x))
        .attr("cy", d => yScale(d.y))
        .attr("r", 14)
        .attr("fill", d => teamColours[d.team] || 'black')
        .attr('stroke', 'black')
        .attr('stroke-width',2)        
        .on("mouseover", (event, d) => {
          setTooltipData(d); // Store the entire data object
          setTooltipVisibility('visible');
        })
        
        .on("mousemove", (event) => {
          setTooltipPosition({ left: event.pageX - 30, top: event.pageY + 30 });
        })
        .on("mouseleave", () => {
          setTooltipVisibility('hidden');
        });

      // Adding labels to circles
      g.selectAll("text.team-abbr")
      .data(data)
      .enter()
      .append('text')
        .attr("class", "team-abbr")
        .attr('x', d => xScale(d.x))
        .attr('y', d => yScale(d.y))
        .style("font-size", "9px")
        .style("fill", "#ffffff") // 
        .style("font-weight", "bold")
        .style("text-anchor", "middle")
        .style("dominant-baseline", "central")
        .text(d => teamAbbr[d.team]); // Use abbreviation from teamAbbr
      
      svg.attr('viewBox', `0 0 ${dimensions.width} ${dimensions.height}`);
    }
  }, [data, dimensions]); // Rerun when data or dimensions change

  
  return (
    <Flex direction="column" align="center" p={5}>
      <Heading size="lg" color="teal.500" mb={4} textAlign="center">
        Team Strengths
      </Heading>
      <Box width="100%"  borderWidth="2px" borderColor="gray.300" borderRadius="lg">
        <svg ref={svgRef} width="100%" height="100%"></svg>
        
        <div
          className="tooltip"
          style={{
            display: tooltipVisibility === 'visible' ? 'block' : 'none',
            position: 'absolute',
            backgroundColor: 'white',
            border: 'solid',
            borderWidth: '2px',
            borderRadius: '5px',
            padding: '5px',
            pointerEvents: 'none', // Make sure tooltip does not block mouse events
            left: `${tooltipPosition.left}px`,
            top: `${tooltipPosition.top}px`,
          }}
        >
          {tooltipData && (
            <>
              <div>{tooltipData.team}</div>
              <div>Offence: {tooltipData.x}</div>
              <div>Defence: {tooltipData.y}</div>
            </>
  )}
</div>
      </Box>
    </Flex>
    
  
  );
}

