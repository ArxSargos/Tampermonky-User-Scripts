// ==UserScript==
// @author      Martin Nechvatal <martin.nech@gmail.com>
// @name        JIRA advanced labels
// @namespace   JIRA
// @description Takes JIRA backlog labels repositions them and gives them color backgrounds
// @match     https://jirasson.betsson.local/secure/*
// @version     0.9
// @grant       none
// ==/UserScript==

/* Insert CSS hiding labels from separate line, so it doesn't break scroll position when removed from DOM later */
var hideDefaultLabelsRowStyle = document.createElement("style");
var css  = ".ghx-backlog .ghx-plan-extra-fields.ghx-plan-extra-fields-1.ghx-row { display: none !important;}";
    css += ".usOwnLabel {display: inline-block; margin: 0 3px; padding: 0 3px; border: 1px solid #666;}";
hideDefaultLabelsRowStyle.type = 'text/css';
if (hideDefaultLabelsRowStyle.styleSheet){
  hideDefaultLabelsRowStyle.styleSheet.cssText = css;
} else {
  hideDefaultLabelsRowStyle.appendChild(document.createTextNode(css));
}

var headRef = document.head || document.getElementsByTagName('head')[0];
headRef.appendChild(hideDefaultLabelsRowStyle);
/* ---------------------------------------------------------------------------------------------------------------*/

/* -- JS code ----------------------------------------------------------------------------------------------------*/
/* Maximum count of tries when waiting for backlog container element */
var triesCount = 0;

/* Semaphore for not triggering on DOMNodeInserted as we are also inserting nodes */
var traverseInProgress = false;


/* Parses labels from data-tooltip attribute */
function parseLabels(labelsElement) {
  var unparsed = labelsElement.getAttribute("data-tooltip");
  var labels = unparsed.substring(8).split(", "); /* Trimming "Labels: " and splitting */
  return labels;
}

/* Takes text and returns rgb color computed based on this text */
function calculateLabelColors(label) {
  var red = 0;
  var green = 0;
  var blue = 0;
  for (var i=0, end=label.length; i<end; i++) {
    var charCode = label.charCodeAt(i);
    switch ((i)%3) {
    	case 0: red += charCode * 100;
      				green += charCode * 40;
              blue += charCode * 40;
          break;
      case 1: red += charCode * 40;
      				green += charCode * 100;
              blue += charCode * 40;
          break;
      case 2: red += charCode * 40;
      				green += charCode * 40;
      				blue += charCode * 100;
          break;
  	}
  }
  red = red % 255;
  green = green % 255;
  blue = blue % 255;
  
  var textColor = "color: rgb(245, 245, 245)";
  if ( red + green + blue > 500 || green >= 200 ) { /* Too bright BG use dark font color */
    textColor = "color: rgb(66, 66, 66)";
  }
  return "rgb("+red+", "+green+", "+blue+");" + textColor;
}

/* Takes labels (Array of strings) and decorates them by html tags and attributes */
function generateLabelsHTML(labels) {
  if (labels.length === 1 && labels[0] === "None") { /* Ignoring "None" labels */
    return "";
  }
  
  var labelsHTML = "";
  for (label of labels) {
    if (label.match(/\[[A-z]+\]/g)) { /* Is special label */
      labelsHTML = "<span class='usOwnLabel' style='background: #333; color: #eee; font-weight: bold;'>" + label.substring(1, label.length - 1) + "</span>" + labelsHTML;
    } else { /* other labels */
      var colors = calculateLabelColors(label);
      labelsHTML = labelsHTML + "<span class='usOwnLabel' style='background: "+colors+";'>" + label + "</span>";
    }
  }
  return labelsHTML;
}


/* Traverses DOM backlog, removes old labels and creates new one with proper styling and puts them into backlog item summary */
function traverseBacklog() {
  if (traverseInProgress) {
    return;
  }
  
  
  /* Get all elements containg labels information */
  var labelRows = document.querySelectorAll(".ghx-plan-extra-fields [data-tooltip*='Labels:']");
  if (labelRows.length === 0) {
    /* Set traversing flag */
    traverseInProgress = false;
    return;
  }
  
  /* Set traversing flag */
  traverseInProgress = true;
  
  /* Removing already parsed element, so we don't parse it again for any reason */
  var oldRowsElementsToRemove = [];
  
  /* Render and append label tags to Summary */
  for (labelRow of labelRows) {
    var issueContentElm = labelRow.parentNode.parentNode;
    
    oldRowsElementsToRemove.push(labelRow.parentNode);
    
    var labels = parseLabels(labelRow);
    var labelsRowHTML = generateLabelsHTML(labels);
    
    var sumElm = issueContentElm.querySelector(".ghx-summary");
    var labelsElm = document.createElement("span");
    labelsElm.innerHTML = labelsRowHTML;
    sumElm.insertBefore(labelsElm, sumElm.firstChild);
  }
  
  /* Remove old label rows */
  for (var toRemoveElement of oldRowsElementsToRemove) {
    toRemoveElement.parentNode.removeChild(toRemoveElement);
  }
  oldRowsElementsToRemove = null;
  
  /* Everything is done, reset flag */
  traverseInProgress = false;
}

/* Wait for rendered backlog */
function waitForBacklog() {
  var backlogElm = document.getElementById("ghx-backlog");
  if (!backlogElm) {
    triesCount++;
    if (triesCount < 5) {
      setTimeout(waitForBacklog, triesCount * 1000);
    }
    return;
  } else {
    backlogElm.addEventListener("DOMNodeInserted", function (ev) {
      traverseBacklog();
    }, false);
    
    /* First traversal */
    console.log("First traversal");
    traverseBacklog();
  }
}

/* Detect SPA opening of backlog url */
window.onpopstate = function(event) {
  /* If url contains rapidView=NUMBER&view=planning we want to initiate our script */
  var isBacklogPage = document.location.match(/.+rapidView=[0-9]+.+view=planning.*/g);
  if (isBacklogPage) {
    waitForBacklog();
  }
};

waitForBacklog();