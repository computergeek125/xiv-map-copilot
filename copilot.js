async function printJSON(infile) {
    const response = await fetch(infile);
    const json = await response.json();
    console.log(json);
}