// Every source used by the map, shown in "About and sources". Add to this list whenever something new is used.
window.SOURCES = [
  { group: 'Logbook data', items: [
    { title: 'CLIWOC 2.1: Climatological Database for the World’s Oceans, 1662–1855', who: 'CLIWOC project (García-Herrera, Können, Wheeler, Prieto, Jones, Koek and others); version 2.1 published at DANS', licence: 'CC0', url: 'https://doi.org/10.17026/dans-2bx-dutg', used: 'All ship positions, words, Beaufort and m/s values, ship details and archive references. Storms are found from these entries.' },
    { title: 'CLIWOC: a climatological database for the world’s oceans 1750–1854', who: 'García-Herrera, R., Können, G. P., Wheeler, D., Prieto, M. R., Jones, P. D., Koek, F. B. (2005), Climatic Change 73', licence: 'cited', url: 'https://doi.org/10.1007/s10584-005-6952-6', used: 'How the logbooks were chosen, typed and converted.' },
  ]},
  { group: 'Words and numbers', items: [
    { title: 'From calm to storm: the origins of the Beaufort wind scale', who: 'Wheeler, D. and Wilkinson, C. (2004), The Mariner’s Mirror 90(2)', licence: 'cited', url: 'https://doi.org/10.1080/00253359.2004.10656896', used: 'The history of the scale and of the logbook wind words.' },
    { title: 'Beaufort scale wind speed bands', who: 'World Meteorological Organization', licence: 'cited', url: 'https://library.wmo.int/', used: 'Beaufort numbers from m/s.' },
    { title: 'English glosses of Dutch, Spanish and French wind, weather and sea words', who: 'Compiled for this map from the CLIWOC dictionary terms and standard maritime usage', licence: 'this project', url: '', used: 'The word-by-word English under each logbook phrase. A gloss, not a translation.' },
    { title: 'English translations of the ship notes', who: 'Machine-assisted translation for this map, from the CLIWOC “OtherShipInformation” field', licence: 'this project', url: '', used: 'Ship notes in the pop-up. Unclear passages are marked (?).' },
  ]},
  { group: 'Map and ship view', items: [
    { title: 'Natural Earth 1:50m land', who: 'Natural Earth', licence: 'public domain', url: 'https://www.naturalearthdata.com/', used: 'Coastlines.' },
    { title: 'three.js', who: 'three.js authors', licence: 'MIT', url: 'https://threejs.org/', used: 'The ship view: linework, still isometric camera and the moving air.' },
    { title: 'Architectura Navalis Mercatoria', who: 'Fredrik Henrik af Chapman (1768)', licence: 'public domain', url: 'https://commons.wikimedia.org/wiki/Category:Architectura_Navalis_Mercatoria', used: 'Hull proportions of the ship types (ship of the line, frigate, East Indiaman, brig, cutter).' },
    { title: 'The Elements and Practice of Rigging and Seamanship', who: 'David Steel (1794)', licence: 'public domain', url: 'https://archive.org/search?query=steel+elements+rigging+seamanship', used: 'Mast and yard proportions, how sails were reefed and furled, striking topgallant masts in a storm.' },
    { title: 'Ship paint schemes, copper sheathing and ensigns by navy and period', who: 'Compiled for this map from general naval history (e.g. the "Nelson chequer" after 1805; Royal Navy coppering from c. 1780; Spanish red-and-yellow ensign from 1785; French tricolour from 1794)', licence: 'this project', url: '', used: 'How each typical ship is painted and which flag it flies. Interpretive; individual ships varied.' },
  ]},
  { group: 'Instruments, sightings and other layers', items: [
    { title: 'Barometer, thermometer and compass readings', who: 'CLIWOC 2.1 (SLP, AT and Decl, with the readings as written)', licence: 'CC0', url: 'https://doi.org/10.17026/dans-2bx-dutg', used: 'The Barometer and temperature and Compass needles layers, the instruments in the ship pop-up and the pressure line in the voyage chart.' },
    { title: 'Sky and sea sightings', who: 'Found for this map by searching the CLIWOC remarks in Dutch, English, Spanish and French, plus CLIWOC sea-ice, snow and hail markers; see tools/build-data.mjs', licence: 'this project', url: '', used: 'The Sky and sea layer and list. A keyword search: some sightings will be missed, a few may be misread.' },
    { title: 'Zero meridians', who: 'CLIWOC 2.1 ZeroMeridian; where each lies is estimated for this map from the difference between the longitude as written and the converted longitude in CLIWOC', licence: 'this project', url: '', used: 'The Zero meridians layer.' },
  ]},
  { group: 'Slavery in the logbooks', items: [
    { title: 'Slave voyages and encounters', who: 'Found for this map in the CLIWOC remarks (cargo, life on board, other remarks, encounters); see tools/build-slavery.mjs', licence: 'this project', url: '', used: 'The squares and tracks in the slavery colour. Marked by voyage; recorded where the logbook says so, likely only for slaving-company voyages on the Africa–Americas route.' },
    { title: 'Middelburgsche Commercie Compagnie archive', who: 'Zeeuws Archief, Middelburg (the source of the MCC logbooks in CLIWOC)', licence: 'cited', url: 'https://www.zeeuwsarchief.nl/en/', used: 'Where the slave-voyage logbooks are held.' },
    { title: 'Trans-Atlantic Slave Trade Database', who: 'SlaveVoyages.org', licence: 'cited', url: 'https://www.slavevoyages.org/', used: 'For checking the voyages against an independent record (not yet done for each voyage).' },
  ]},
  { group: 'Events of Empire', items: [] },
];
