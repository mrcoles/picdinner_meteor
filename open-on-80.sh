#!/usr/bin/env bash

#
# Use this to expose your app on port 80. It can
# then be loaded by other devices, like your phone
# by using your machine's ip address.
#

echo "Forwarding port 80 to port 3000..."

sudo socat TCP-LISTEN:80,fork TCP:localhost:3000
