<?php
header('Content-Type: text/plain; charset=UTF-8');
echo "Current directory:\n";
echo __DIR__ . "\n\n";
echo "Suggested .htpasswd path if placed in this directory:\n";
echo __DIR__ . DIRECTORY_SEPARATOR . ".htpasswd" . "\n";
?>
