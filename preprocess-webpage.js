const cheerio = require("cheerio");
const unirest = require("unirest");
const ejs = require('ejs');
const fs = require('fs');

// Scrape Google Scholar for aggregate info (e.g. h-index)
const scrapeGoogleScholar = async () => {
  try {
    const url = "https://scholar.google.nl/citations?user=zqb-X38AAAAJ&hl";
    const response = await unirest.get(url).headers({
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36"
    });

    const $ = cheerio.load(response.body);
    const authorResults = {
      name: $("#gsc_prf_in").text(),
      position: $("#gsc_prf_inw+ .gsc_prf_il").text(),
      email: $("#gsc_prf_ivh").text(),
      departments: $("#gsc_prf_int").text()
    };

    const citedBy = {
      citations: {
        all: $("tr:nth-child(1) .gsc_rsb_sc1+ .gsc_rsb_std").text()
      },
      hIndex: {
        all: $("tr:nth-child(2) .gsc_rsb_sc1+ .gsc_rsb_std").text()
      },
      iIndex: {
        all: $("tr~ tr+ tr .gsc_rsb_sc1+ .gsc_rsb_std").text()
      }
    };

    return {
      citationSum: citedBy.citations.all,
      hIndex: citedBy.hIndex.all,
      iIndex: citedBy.iIndex.all
    };
  } catch (error) {
    console.error("Error occurred while scraping Google Scholar:", error);
  }
};

// Scrape PubMed for all publication info
const scrapePubmed = async () => {
    const HTMLpublication = '<tr><td>%authors%</td><td>%title%</td><td><i>%journal%</i></td><td>%date%</td><td><a href="%data%" target="_blank">%PMID%</a></td></tr>';

    const pubmedSearchAPI = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?";
    const pubmedSummaryAPI = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?";
    const database = "db=pubmed";
    const returnMode = "&retmode=json";
    const returnMax = "&retmax=500";
    const searchTerm = "&term=Fu, EL [Author] OR 37397081";
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

    // const getAffiliations = async (url) => {
    //   const fetch = require('node-fetch');

    //   const pmid = 'YOUR_PMID_HERE'; // Replace with your PubMed ID
    //   const url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmid}&retmode=xml`;

    //   fetch(url)
    //     .then(response => response.text())
    //     .then(data => {
    //       // Parse the XML response to extract affiliations
    //       const parser = new DOMParser();
    //       const xmlDoc = parser.parseFromString(data, 'text/xml');
    //       const authors = xmlDoc.getElementsByTagName('Author');
    //       for (let i = 0; i < authors.length; i++) {
    //         const affiliations = authors[i].getElementsByTagName('Affiliation');
    //         for (let j = 0; j < affiliations.length; j++) {
    //           console.log(affiliations[j].textContent);
    //         }
    //       }
    //     })
    //     .catch(error => console.error('Error:', error));

    // }

    // const getAddressFromAffiliation = async (url) => {
      // const fetch = require('node-fetch');

      // const affiliation = 'Department of Computer Science, University of Example, Example City, Country'; // Replace with actual affiliation string
      // const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(affiliation)}&format=json`;

      // fetch(url)
      //   .then(response => response.json())
      //   .then(data => {
      //     if (data.length > 0) {
      //       const address = data[0].display_name;
      //       console.log(`Address: ${address}`);
      //     } else {
      //       console.error('No results found');
      //     }
      //   })
      //   .catch(error => console.error('Error:', error));

    // }

    // const getLongLatFromAddress = async (url) => {
    //   const fetch = require('node-fetch');

    //   const address = 'YOUR_AFFILIATION_ADDRESS_HERE'; // Replace with the actual address
    //   const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json`;

    //   fetch(url)
    //     .then(response => response.json())
    //     .then(data => {
    //       if (data.length > 0) {
    //         const location = data[0];
    //         console.log(`Latitude: ${location.lat}, Longitude: ${location.lon}`);
    //       } else {
    //         console.error('No results found');
    //       }
    //     })
    //     .catch(error => console.error('Error:', error));
    //   }

    const formatReferences = (summary) => {
        let publicationList = '';
        let firstAuthorships = 0;
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
        
            let lastAuthor = summary.result[refs].lastauthor;
            if (lastAuthor === 'Fu EL') {
                lastAuthor = `<b>${lastAuthor}</b>`;
                lastAuthorships++;
            }
            authors += lastAuthor;
        
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
  const citationInfo = await scrapeGoogleScholar();
  const { publicationList, numberOfPapers, firstAuthorships, lastAuthorships } = await scrapePubmed();

  let authorStats = `<b>Number of papers:</b> ${numberOfPapers} <br>
                     <b>Number of first authorships:</b> ${firstAuthorships}<br>
                     <b>Number of last authorships:</b> ${lastAuthorships} <br>
                     <b>Total number of citations:</b> ${citationInfo.citationSum} <br>
                     <b>H-index:</b> ${citationInfo.hIndex} <br>`;

  const templateFiles = ['docs/index.html', 'docs/pages/cv.html', 'docs/pages/network.html', 'docs/pages/publications.html', 'docs/pages/talks.html', 'docs/pages/team.html'];

  templateFiles.forEach((filePath) => {
    const template = fs.readFileSync(filePath, 'utf-8');
    const renderedHtml = ejs.render(template, { authorStats, publicationList });
    fs.writeFileSync(filePath, renderedHtml);
  });

  console.log("Done rendering HTML files.");
};

main();
