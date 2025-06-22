// @ts-check

const { getJson } = require("serpapi");
const ejs = require('ejs');
const fs = require('fs');

// Scrape PubMed for all publication info
const scrapePubmed = async () => {
    const HTMLpublication = '<tr><td>%authors%</td><td>%title%</td><td><i>%journal%</i></td><td>%date%</td><td><a href="%data%" target="_blank">%PMID%</a></td></tr>';

    const pubmedSearchAPI = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?";
    const pubmedSummaryAPI = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?";
    const database = "db=pubmed";
    const returnMode = "&retmode=json";
    const returnMax = "&retmax=500";
    const searchTerm = "&term=Fu, EL OR 37397081";
    const returnType = "&rettype=abstract";
    const idURL = `${pubmedSearchAPI}${database}${returnMode}${returnMax}${searchTerm}`;

    const getPubmed = async (url) => {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Error: ${response.status}`);
        }
        return response.json();
        };


    const formatReferences = (summary) => {
        let publicationList = '';
        let firstAuthorships = 2; // Two papers as shared co-first author: PMID 34826514 and PMID 36280224
        let lastAuthorships = 0;
        let numberOfPapers = 0;
        
        for (const refs in summary.result) {
            if (refs !== 'uids') {
            let authors = '';
        
            summary.result[refs].authors.forEach((author, index) => {
                let authorName = author.name === 'Fu E' ? 'Fu EL' : author.name;
                if (authorName === 'Fu EL') {
                  authorName = `<b>${authorName}</b>`;
                  if (index === 0) firstAuthorships++;
                }
                authors += `${authorName}, `;
            });
            authors = authors.slice(0, -2); // Remove trailing , and space
        
            let lastAuthor = summary.result[refs].lastauthor;
            if (lastAuthor === 'Fu EL') {
                lastAuthorships++;
            }
        
            let publication = HTMLpublication.replace('%data%', `http://www.ncbi.nlm.nih.gov/pubmed/${refs}`)
                .replace('%authors%', authors)
                .replace('%title%', summary.result[refs].title)
                .replace('%journal%', summary.result[refs].source)
                .replace('%PMID%', summary.result[refs].uid);
        
            if (summary.result[refs].volume) {
                publication = publication.replace('%volume%', ` ${summary.result[refs].volume}`)
                .replace('%issue%', `(${summary.result[refs].issue})`)
                .replace('%pages%', `: ${summary.result[refs].pages}. `)
                .replace('%date%', summary.result[refs].pubdate.slice(0, 4));
            } else {
                publication = publication.replace('%volume%', ' In Press')
                .replace('%issue%', '.')
                .replace('%pages%', '')
                .replace('%date%', '');
            }
        
            publicationList = publication + publicationList;
            numberOfPapers++;
            }
        }
        return { publicationList, numberOfPapers, firstAuthorships, lastAuthorships };
        };

    try {
        const data = await getPubmed(idURL);
        const idList = data.esearchresult.idlist.toString();
        const summaryURL = `${pubmedSummaryAPI}${database}${returnMode}${returnType}&id=${idList}`;
        const summary = await getPubmed(summaryURL);
        return formatReferences(summary);
    } catch (error) {
        console.error("Error occurred while scraping PubMed:", error);
    }
};



const main = async () => {

  // // Scrape Google Scholar for aggregate info (e.g. h-index)
  const citationInfo = await getJson({
    engine: "google_scholar_author",
    author_id: "zqb-X38AAAAJ",
    api_key: process.env.SERPAPI_KEY
  });
  
  
  let allCitations, H_index;
  citationInfo.cited_by.table.forEach(entry => {
    if (entry.citations) {
      allCitations = entry.citations.all;
    } else if (entry.h_index) {
      H_index = entry.h_index.all;
    }
  });

  // Scrape Pubmed
  const { publicationList, numberOfPapers, firstAuthorships, lastAuthorships } = await scrapePubmed();

  // Store info in html code snippet
  let authorStats = `<b>Number of papers:</b> ${numberOfPapers} <br>
                     <b>Number of first authorships:</b> ${firstAuthorships}<br>
                     <b>Number of last authorships:</b> ${lastAuthorships} <br>
                     <b>Total number of citations:</b> ${allCitations} <br>
                     <b>H-index:</b> ${H_index} <br>`;

  console.log(authorStats)

  // Substitute html snippet in target file(s)
  const templateFiles = ['docs/index.html', 'docs/pages/biography.html', 'docs/pages/network.html', 'docs/pages/publications.html', 'docs/pages/talks.html', 'docs/pages/team.html'];

  templateFiles.forEach((filePath) => {
    const template = fs.readFileSync(filePath, 'utf-8');
    const renderedHtml = ejs.render(template, { authorStats, publicationList });
    fs.writeFileSync(filePath, renderedHtml);
  });

  console.log("Done rendering HTML files.");
};

main();
