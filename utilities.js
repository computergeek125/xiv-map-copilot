/**
 * Grabs a JSON file from the interwebs
 * @param  {String} infile  The file to download
 * @return {json}   json    The processed object
 */
async function fetchJSON(infile) {
    const response = await fetch(infile);
    const json = await response.json();
    return json;
}

/**
 * Sanitize and encode all HTML in a user-submitted string
 * https://portswigger.net/web-security/cross-site-scripting/preventing
 * From: https://gomakethings.com/how-to-sanitize-third-party-content-with-vanilla-js-to-prevent-cross-site-scripting-xss-attacks/
 * @param  {String} str  The user-submitted string
 * @return {String} str  The sanitized string
 */
function sanitizeHTML(str) {
    return str.replace(/[^\w. ]/gi, function (c) {
        return '&#' + c.charCodeAt(0) + ';';
    });
}

/**
 * Generate an SVG polygon in the shape of an X
 * @param {Integer} x      X-position of the center
 * @param {Integer} y      Y-position of the center
 * @param {Integer} r      X/Y radius of the cross
 * @param {String}  f      Fill color of polygon (default = red)
 * @param {Float}   r_edge Edge offset as a decimal percentage of `r` - so 0.1 == 10%
 * @return {Object} cross  An SVG polygon cross that can be appended to an <svg> element
 */
function gen_svg_cross(x, y, r, f="red", r_edge=0.1) {
    // cross: <polygon points="5 0, 25 20, 45 0, 50 5, 30 25, 50 45, 45 50, 25 30, 5 50, 0 45, 20 25, 0 5" fill="red" />
    //const cross_template = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    //cross_template.setAttribute("points", "5 0, 25 20, 45 0, 50 5, 30 25, 50 45, 45 50, 25 30, 5 50, 0 45, 20 25, 0 5");
    //cross_template.setAttribute("fill", "red");
    edge = r*r_edge;
    offset = r-edge;
    lr = Math.round(x-r);
    lo = Math.round(x-offset);
    le = Math.round(x-edge);
    tr = Math.round(y-r);
    to = Math.round(y-offset);
    te = Math.round(y-edge);
    rr = Math.round(x+r);
    ro = Math.round(x+offset);
    re = Math.round(x+edge);
    br = Math.round(y+r);
    bo = Math.round(y+offset);
    be = Math.round(y+edge);
    

    const cross = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    //                            top left T    center T     top right T   top right R   center R     bot right R   bot right B   center B     bot left B    bot left L    center L     top left L
    cross.setAttribute("points", `${lo} ${tr},  ${x} ${te},  ${ro} ${tr},  ${rr} ${to},  ${re} ${y},  ${rr} ${bo},  ${ro} ${br},  ${x} ${be},  ${lo} ${br},  ${lr} ${bo},  ${le} ${y},  ${lr} ${to}`)
    cross.setAttribute("fill", f);
    return cross
}

function img_resize_svg(e) {
    map_img = e.target;
    map_svg_id = `${map_img.id}-overlay`;
    map_svg = document.getElementById(map_svg_id);
    const mi_w = map_img.naturalWidth;
    const mi_h = map_img.naturalHeight;
    map_svg.setAttribute("viewBox", `0 0 ${mi_w} ${mi_h}`)

    console.log(`Resized ${map_svg_id} to ${mi_w}x${mi_h}`);
}

function jedi_sith() {
    if (document.documentElement.getAttribute('data-bs-theme') == 'dark') {
        document.documentElement.setAttribute('data-bs-theme','light')
    }
    else {
        document.documentElement.setAttribute('data-bs-theme','dark')
    }
}